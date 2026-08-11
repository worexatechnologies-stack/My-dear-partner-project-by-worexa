from __future__ import annotations

from io import BytesIO
import struct
import zlib

import pytest
from django.db import IntegrityError, connection, transaction
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.utils import CaptureQueriesContext
from PIL import Image, ImageOps, TiffImagePlugin
from rest_framework import status
from rest_framework.test import APIRequestFactory

from apps.accounts.models import AdminPermission, AdminRolePermission
from apps.core.serializers import MemberPublicSerializer
from apps.core.models import (
    ProfileBlock,
    ProfileVerificationAssignment,
    ProfileVerificationRequest,
    WorkAssignment,
)
from apps.profiles.models import ProfilePhoto, ProfilePhotoAuditLog, UserProfileImage
from apps.profiles.photo_permissions import can_view_profile_photo
from apps.profiles.serializers import MemberProfileSummarySerializer
from apps.profiles.services.image_processing import ImageProcessingService


pytestmark = pytest.mark.django_db


def image_upload(
    image_format="JPEG",
    *,
    size=(900, 1200),
    color=(40, 120, 220),
    orientation=None,
    filename=None,
):
    image = Image.new("RGB", size, color)
    buffer = BytesIO()
    save_kwargs = {}
    if orientation is not None and image_format == "JPEG":
        exif = Image.Exif()
        exif[274] = orientation
        # A GPS-like EXIF field confirms that processing produces a new file
        # rather than copying source metadata into the WebP output.
        exif[270] = "private metadata"
        save_kwargs["exif"] = exif
    try:
        image.save(buffer, format=image_format, **save_kwargs)
    except KeyError:
        image.save(buffer, format="JPEG")
        image_format = "JPEG"
    suffix = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(image_format, "jpg")
    return SimpleUploadedFile(
        filename or f"portrait.{suffix}",
        buffer.getvalue(),
        content_type=f"image/{'jpeg' if image_format == 'JPEG' else image_format.lower()}",
    )


def oversized_dimension_png_upload() -> SimpleUploadedFile:
    """A valid PNG container whose raster exceeds the decoded-pixel ceiling.

    Pillow's verify pass checks chunk integrity without allocating the declared
    48-megapixel raster, which makes this a safe memory-limit regression input.
    """

    def chunk(kind: bytes, data: bytes) -> bytes:
        checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)

    header = struct.pack(">IIBBBBB", 8000, 6000, 8, 2, 0, 0, 0)
    payload = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(b""))
        + chunk(b"IEND", b"")
    )
    return SimpleUploadedFile("oversized-dimensions.png", payload, content_type="image/png")


def gps_image_upload() -> SimpleUploadedFile:
    image = Image.new("RGB", (900, 1200), (40, 120, 220))
    rational = TiffImagePlugin.IFDRational
    exif = Image.Exif()
    exif[34853] = {
        1: "N",
        2: (rational(12, 1), rational(34, 1), rational(56, 1)),
        3: "E",
        4: (rational(78, 1), rational(9, 1), rational(10, 1)),
    }
    buffer = BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return SimpleUploadedFile("gps-photo.jpg", buffer.getvalue(), content_type="image/jpeg")


def create_photo(member, *, status_value=ProfilePhoto.Status.APPROVED, primary=True):
    processed = ImageProcessingService.process_profile_photo(image_upload())
    return ProfilePhoto.objects.create(
        user=member,
        image_data=processed.image_bytes,
        thumbnail_data=processed.thumbnail_bytes,
        mime_type=processed.mime_type,
        original_filename="portrait.jpg",
        original_size_bytes=processed.original_size_bytes,
        compressed_size_bytes=processed.compressed_size_bytes,
        thumbnail_size_bytes=processed.thumbnail_size_bytes,
        width=processed.width,
        height=processed.height,
        thumbnail_width=processed.thumbnail_width,
        thumbnail_height=processed.thumbnail_height,
        checksum=processed.checksum,
        status=status_value,
        is_primary=primary,
    )


def set_role_permissions(account, *codes):
    AdminRolePermission.objects.filter(role=account.role).delete()
    for code in codes:
        permission, _ = AdminPermission.objects.get_or_create(
            code=code,
            defaults={"name": code, "module": code.split(".")[0], "description": ""},
        )
        AdminRolePermission.objects.create(
            role=account.role,
            permission=permission,
            is_allowed=True,
        )


@pytest.mark.parametrize("image_format", ["JPEG", "PNG", "WEBP"])
def test_supported_uploads_are_webp_bytea_and_return_only_metadata(
    authenticated_client, member, image_format
):
    response = authenticated_client(member).post(
        "/api/profile-photos/",
        {"photo": image_upload(image_format)},
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    payload = response.data["data"]
    assert payload["image_url"].startswith("/api/profile-photos/")
    assert "/thumbnail/?v=" in payload["thumbnail_url"]
    assert "image_data" not in payload
    assert "thumbnail_data" not in payload

    expected_fmt, expected_mime = ImageProcessingService.get_encoding_config()
    photo = ProfilePhoto.objects.get(pk=payload["id"])
    assert isinstance(photo.image_data, (bytes, memoryview))
    assert isinstance(photo.thumbnail_data, (bytes, memoryview))
    assert photo.mime_type == expected_mime
    assert (photo.width, photo.height) == (1200, 1500)


def test_legacy_registration_image_endpoint_uses_moderated_photo_pipeline(
    authenticated_client, member
):
    response = authenticated_client(member).post(
        "/api/user-profile-images/",
        {"images": image_upload("PNG")},
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    payload = response.data["data"]
    assert len(payload) == 1
    photo = ProfilePhoto.objects.get(pk=payload[0]["id"])
    assert photo.status == ProfilePhoto.Status.PENDING
    expected_fmt, expected_mime = ImageProcessingService.get_encoding_config()
    assert photo.mime_type == expected_mime
    assert not UserProfileImage.objects.filter(user=member).exists()
    assert ProfileVerificationRequest.objects.filter(
        member=member,
        verification_type=ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
        status=ProfileVerificationRequest.Status.PENDING_REVIEW,
    ).exists()
    assert (photo.thumbnail_width, photo.thumbnail_height) == (240, 300)
    assert photo.compressed_size_bytes <= 600 * 1024
    assert photo.thumbnail_size_bytes <= 100 * 1024
    assert ProfilePhotoAuditLog.objects.filter(
        photo_id=photo.pk, action=ProfilePhotoAuditLog.Action.UPLOADED
    ).exists()


def test_processor_corrects_orientation_strips_metadata_and_crops_to_portrait():
    processed = ImageProcessingService.process_profile_photo(
        image_upload("JPEG", size=(1500, 900), orientation=6)
    )

    main = Image.open(BytesIO(processed.image_bytes))
    thumbnail = Image.open(BytesIO(processed.thumbnail_bytes))
    expected_fmt, expected_mime = ImageProcessingService.get_encoding_config()
    assert main.format == expected_fmt
    assert main.size == (1200, 1500)
    assert thumbnail.size == (240, 300)
    assert not main.getexif()
    assert "exif" not in main.info
    assert len(processed.checksum) == 64


def test_processor_removes_real_gps_ifd_metadata():
    upload = gps_image_upload()
    with Image.open(BytesIO(upload.read())) as source:
        assert source.getexif().get_ifd(34853)
    upload.seek(0)

    processed = ImageProcessingService.process_profile_photo(upload)
    with Image.open(BytesIO(processed.image_bytes)) as main:
        assert not main.getexif()
        assert 34853 not in main.getexif()


def test_invalid_oversized_corrupt_and_too_small_uploads_are_rejected(authenticated_client, member):
    client = authenticated_client(member)
    invalid = SimpleUploadedFile("malware.jpg", b"not an image", content_type="image/jpeg")
    response = client.post("/api/profile-photos/", {"photo": invalid}, format="multipart")
    assert response.status_code == status.HTTP_400_BAD_REQUEST

    oversized = SimpleUploadedFile(
        "large.jpg",
        b"x" * (10 * 1024 * 1024 + 1),
        content_type="image/jpeg",
    )
    response = client.post("/api/profile-photos/", {"photo": oversized}, format="multipart")
    assert response.status_code == status.HTTP_400_BAD_REQUEST

    too_small = image_upload(size=(599, 749))
    response = client.post("/api/profile-photos/", {"photo": too_small}, format="multipart")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert ProfilePhoto.objects.count() == 0


def test_decoded_pixel_limit_is_checked_before_transpose_or_full_load(monkeypatch):
    def unexpected_transpose(_image):
        raise AssertionError("oversized raster reached EXIF transposition")

    monkeypatch.setattr(ImageOps, "exif_transpose", unexpected_transpose)

    with pytest.raises(ValueError, match="dimensions are too large"):
        ImageProcessingService.validate_upload(oversized_dimension_png_upload())


def test_transparent_png_is_flattened_to_an_opaque_background():
    source = Image.new("RGBA", (900, 1200), (255, 0, 0, 0))
    buffer = BytesIO()
    source.save(buffer, format="PNG")
    upload = SimpleUploadedFile("transparent.png", buffer.getvalue(), content_type="image/png")

    processed = ImageProcessingService.process_profile_photo(upload)
    main = Image.open(BytesIO(processed.image_bytes)).convert("RGB")

    assert min(main.getpixel((600, 750))) >= 245


def test_image_and_thumbnail_endpoints_honor_etag_and_cache_backend_clearing(
    authenticated_client, member
):
    photo = create_photo(member)
    client = authenticated_client(member)
    response = client.get(f"/api/profile-photos/{photo.pk}/image/")

    assert response.status_code == status.HTTP_200_OK
    expected_fmt, expected_mime = ImageProcessingService.get_encoding_config()
    assert response["Content-Type"] == expected_mime
    assert response["Cache-Control"] == "private, max-age=86400, must-revalidate"
    assert int(response["Content-Length"]) == len(photo.image_data)
    assert response.content == bytes(photo.image_data)

    cached = client.get(
        f"/api/profile-photos/{photo.pk}/image/",
        HTTP_IF_NONE_MATCH=response["ETag"],
    )
    assert cached.status_code == status.HTTP_304_NOT_MODIFIED
    assert cached["ETag"] == response["ETag"]

    cache.clear()
    thumbnail = client.get(f"/api/profile-photos/{photo.pk}/thumbnail/")
    assert thumbnail.status_code == status.HTTP_200_OK
    assert thumbnail.content == bytes(photo.thumbnail_data)


def test_visibility_rules_cover_owner_approval_rejection_and_blocks(
    authenticated_client, member, other_member, super_admin
):
    member.profile_status = "APPROVED"
    member.save(update_fields=["profile_status", "updated_at"])
    other_member.profile_status = "APPROVED"
    other_member.save(update_fields=["profile_status", "updated_at"])
    photo = create_photo(member, status_value=ProfilePhoto.Status.PENDING)
    owner = authenticated_client(member)
    other = authenticated_client(other_member)
    administrator = authenticated_client(super_admin)

    assert owner.get(f"/api/profile-photos/{photo.pk}/image/").status_code == status.HTTP_200_OK
    with CaptureQueriesContext(connection) as queries:
        denied = other.get(f"/api/profile-photos/{photo.pk}/image/")
    assert denied.status_code == status.HTTP_403_FORBIDDEN
    denied_sql = " ".join(query["sql"].lower() for query in queries.captured_queries)
    assert "image_data" not in denied_sql
    assert "thumbnail_data" not in denied_sql
    assert administrator.get(f"/api/profile-photos/{photo.pk}/image/").status_code == status.HTTP_200_OK

    approved = administrator.post(f"/api/admin/profile-photos/{photo.pk}/approve/")
    assert approved.status_code == status.HTTP_200_OK
    photo.refresh_from_db()
    assert photo.status == ProfilePhoto.Status.APPROVED
    assert photo.verified_by_super_admin_id == super_admin.pk
    assert other.get(f"/api/profile-photos/{photo.pk}/thumbnail/").status_code == status.HTTP_200_OK

    # Photo approval is independent from the broader profile-review workflow.
    # A target's DRAFT profile must not hide a photo the moderator approved.
    member.profile_status = "DRAFT"
    member.save(update_fields=["profile_status", "updated_at"])
    assert other.get(f"/api/profile-photos/{photo.pk}/thumbnail/").status_code == status.HTTP_200_OK
    request = APIRequestFactory().get("/api/profiles/")
    request.user = other_member
    payload = MemberPublicSerializer(member, context={"request": request}).data
    assert payload["photo"] and str(photo.pk) in payload["photo"]
    assert payload["photo_visibility"] == "visible"

    # An active viewer's own profile-review state also must not hide approved
    # discovery photos. Account status, blocks, and per-photo approval remain
    # the enforcement boundaries.
    other_member.profile_status = "PENDING"
    other_member.save(update_fields=["profile_status", "updated_at"])
    assert other.get(f"/api/profile-photos/{photo.pk}/thumbnail/").status_code == status.HTTP_200_OK
    other_member.profile_status = "APPROVED"
    other_member.save(update_fields=["profile_status", "updated_at"])

    ProfileBlock.objects.create(blocker=member, blocked=other_member)
    assert other.get(f"/api/profile-photos/{photo.pk}/thumbnail/").status_code == status.HTTP_403_FORBIDDEN
    ProfileBlock.objects.all().delete()

    rejected = administrator.post(
        f"/api/admin/profile-photos/{photo.pk}/reject/", {"reason": "Not suitable"}, format="json"
    )
    assert rejected.status_code == status.HTTP_200_OK
    photo.refresh_from_db()
    assert photo.status == ProfilePhoto.Status.REJECTED
    assert other.get(f"/api/profile-photos/{photo.pk}/thumbnail/").status_code == status.HTTP_403_FORBIDDEN
    assert owner.get(f"/api/profile-photos/{photo.pk}/image/").status_code == status.HTTP_200_OK


def test_head_is_metadata_only_and_unauthenticated_or_deactivated_owner_is_denied(
    authenticated_client, api_client, member
):
    photo = create_photo(member)
    client = authenticated_client(member)

    with CaptureQueriesContext(connection) as queries:
        response = client.head(f"/api/profile-photos/{photo.pk}/thumbnail/")
    assert response.status_code == status.HTTP_200_OK
    assert int(response["Content-Length"]) == photo.thumbnail_size_bytes
    sql = " ".join(query["sql"].lower() for query in queries.captured_queries)
    assert "image_data" not in sql
    assert "thumbnail_data" not in sql

    assert api_client.get(f"/api/profile-photos/{photo.pk}/image/").status_code == status.HTTP_401_UNAUTHORIZED
    member.is_active = False
    member.save(update_fields=("is_active", "updated_at"))
    assert can_view_profile_photo(member, photo) is False
    assert client.get(f"/api/profile-photos/{photo.pk}/image/").status_code in {
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    }


def test_binary_fetch_fails_closed_if_photo_changes_after_authorization(
    authenticated_client, member, other_member, monkeypatch
):
    member.profile_status = "APPROVED"
    member.save(update_fields=("profile_status", "updated_at"))
    other_member.profile_status = "APPROVED"
    other_member.save(update_fields=("profile_status", "updated_at"))
    photo = create_photo(member)

    from apps.profiles import views as photo_views

    original_fetch = photo_views._binary_photo_or_404

    def replace_between_queries(metadata, field_name):
        ProfilePhoto.objects.filter(pk=metadata.pk).update(
            status=ProfilePhoto.Status.PENDING,
            image_data=b"new unreviewed bytes",
            compressed_size_bytes=len(b"new unreviewed bytes"),
        )
        return original_fetch(metadata, field_name)

    monkeypatch.setattr(photo_views, "_binary_photo_or_404", replace_between_queries)
    response = authenticated_client(other_member).get(
        f"/api/profile-photos/{photo.pk}/image/"
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert b"new unreviewed bytes" not in response.content


def test_staff_photo_moderation_is_action_and_assignment_scoped(
    authenticated_client, member, staff_account
):
    photo = create_photo(member, status_value=ProfilePhoto.Status.PENDING)
    set_role_permissions(staff_account, "members.view")
    endpoint = f"/api/admin/profile-photos/{photo.pk}/approve/"

    assert authenticated_client(staff_account).post(endpoint).status_code == status.HTTP_403_FORBIDDEN

    set_role_permissions(staff_account, "verification.approve")
    assert authenticated_client(staff_account).post(endpoint).status_code == status.HTTP_403_FORBIDDEN

    verification = ProfileVerificationRequest.objects.create(
        member=member,
        verification_type=ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
        status=ProfileVerificationRequest.Status.PENDING_REVIEW,
    )
    ProfileVerificationAssignment.objects.create(
        verification_request=verification,
        assigned_to_staff=staff_account,
    )

    approved = authenticated_client(staff_account).post(endpoint)
    assert approved.status_code == status.HTTP_200_OK
    photo.refresh_from_db()
    assert photo.status == ProfilePhoto.Status.APPROVED


def test_primary_constraint_reorder_set_primary_and_six_photo_cap(
    authenticated_client, member
):
    photos = [create_photo(member, primary=index == 0) for index in range(6)]

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            create_photo(member, primary=True)

    client = authenticated_client(member)
    reversed_ids = [str(photo.pk) for photo in reversed(photos)]
    reordered = client.post(
        "/api/profile-photos/reorder/",
        {"photo_ids": reversed_ids},
        format="json",
    )
    assert reordered.status_code == status.HTTP_200_OK
    assert list(
        ProfilePhoto.objects.filter(user=member)
        .order_by("display_order")
        .values_list("pk", flat=True)
    ) == [photo.pk for photo in reversed(photos)]

    promoted = client.post(f"/api/profile-photos/{photos[-1].pk}/set-primary/")
    assert promoted.status_code == status.HTTP_200_OK
    assert ProfilePhoto.objects.get(pk=photos[-1].pk).is_primary is True
    assert ProfilePhoto.objects.filter(user=member, is_primary=True).count() == 1

    over_cap = client.post(
        "/api/profile-photos/", {"photo": image_upload()}, format="multipart"
    )
    assert over_cap.status_code == status.HTTP_400_BAD_REQUEST
    assert "maximum of 6" in str(over_cap.data)


def test_rejected_primary_blocks_another_upload_until_approved(
    authenticated_client, member, super_admin
):
    primary = create_photo(member)
    rejected = authenticated_client(super_admin).post(
        f"/api/admin/profile-photos/{primary.pk}/reject/",
        {"reason": "Needs a clearer face photo"},
        format="json",
    )
    assert rejected.status_code == status.HTTP_200_OK
    primary.refresh_from_db()
    assert primary.status == ProfilePhoto.Status.REJECTED
    assert primary.is_primary is True

    uploaded = authenticated_client(member).post(
        "/api/profile-photos/",
        {"photo": image_upload("PNG", color=(180, 70, 40))},
        format="multipart",
    )
    assert uploaded.status_code == status.HTTP_403_FORBIDDEN
    assert uploaded.data["errors"]["code"] == "PRIMARY_PHOTO_NOT_VERIFIED"
    assert ProfilePhoto.objects.filter(user=member).count() == 1


def test_public_primary_stays_placeholder_without_an_approved_primary(member):
    create_photo(member, status_value=ProfilePhoto.Status.PENDING, primary=True)
    create_photo(member, status_value=ProfilePhoto.Status.APPROVED, primary=False)

    payload = MemberProfileSummarySerializer(member).data
    assert payload["primary_photo"] is None


def test_cache_backend_failure_does_not_rollback_postgresql_photo(
    authenticated_client,
    django_capture_on_commit_callbacks,
    member,
    monkeypatch,
):
    def unavailable_cache(_keys):
        raise ConnectionError("cache unavailable")

    monkeypatch.setattr(cache, "delete_many", unavailable_cache)
    with django_capture_on_commit_callbacks(execute=True):
        response = authenticated_client(member).post(
            "/api/profile-photos/",
            {"photo": image_upload()},
            format="multipart",
        )

    assert response.status_code == status.HTTP_201_CREATED
    assert ProfilePhoto.objects.filter(pk=response.data["data"]["id"]).exists()


def test_deleting_primary_promotes_approved_then_pending_and_removes_binary(
    authenticated_client, member
):
    primary = create_photo(member, status_value=ProfilePhoto.Status.APPROVED)
    replacement = create_photo(member, status_value=ProfilePhoto.Status.APPROVED, primary=False)
    client = authenticated_client(member)

    response = client.delete(f"/api/profile-photos/{primary.pk}/")
    assert response.status_code == status.HTTP_200_OK
    assert not ProfilePhoto.objects.filter(pk=primary.pk).exists()
    replacement.refresh_from_db()
    assert replacement.is_primary is True
    assert response.data["data"]["primary_photo_id"] == str(replacement.pk)
    assert client.get(f"/api/profile-photos/{primary.pk}/image/").status_code == status.HTTP_404_NOT_FOUND


def test_replacement_refreshes_metadata_and_resets_approval(authenticated_client, member):
    photo = create_photo(member)
    old_version = photo.updated_at
    old_thumbnail_url = f"/api/profile-photos/{photo.pk}/thumbnail/?v={int(old_version.timestamp() * 1_000_000)}"
    response = authenticated_client(member).patch(
        f"/api/profile-photos/{photo.pk}/",
        {"photo": image_upload("PNG")},
        format="multipart",
    )

    assert response.status_code == status.HTTP_200_OK
    photo.refresh_from_db()
    assert photo.status == ProfilePhoto.Status.PENDING
    assert photo.updated_at >= old_version
    assert response.data["data"]["version"] == str(int(photo.updated_at.timestamp() * 1_000_000))
    assert response.data["data"]["thumbnail_url"] != old_thumbnail_url
    assert response.data["data"]["thumbnail_url"].endswith(
        f"?v={response.data['data']['version']}"
    )


def test_direct_photo_moderation_completes_the_member_photo_queue(
    authenticated_client, member, staff_account, super_admin
):
    upload = authenticated_client(member).post(
        "/api/profile-photos/", {"photo": image_upload()}, format="multipart"
    )
    assert upload.status_code == status.HTTP_201_CREATED
    photo_id = upload.data["data"]["id"]
    verification = ProfileVerificationRequest.objects.get(
        member=member,
        verification_type=ProfileVerificationRequest.VerificationType.PROFILE_PHOTO,
    )
    verification.status = ProfileVerificationRequest.Status.PENDING_REVIEW
    verification.save(update_fields=("status", "updated_at"))
    ProfileVerificationAssignment.objects.create(
        verification_request=verification,
        assigned_to_staff=staff_account,
    )
    assignment = WorkAssignment.objects.create(
        assignment_type=WorkAssignment.AssignmentType.PHOTO_VERIFICATION,
        assigned_to_staff=staff_account,
        related_profile_verification=verification,
        status=WorkAssignment.Status.ASSIGNED,
    )
    set_role_permissions(
        staff_account,
        "verification.view_assigned",
        "verification.approve",
    )

    staff_client = authenticated_client(staff_account)
    work_list = staff_client.get("/api/v1/staff/my-work/")
    assert work_list.status_code == status.HTTP_200_OK
    listed = work_list.data["data"]["results"][0]
    assert listed["id"] == str(assignment.pk)
    assert listed["member_name"] == member.get_full_name()
    assert listed["member_email"] == member.email
    assert listed["assignment_type_display"] == "Photo verification"
    assert listed["profile_photos"][0]["id"] == photo_id
    assert "image_data" not in listed["profile_photos"][0]

    ProfileVerificationRequest.objects.create(
        member=member,
        verification_type=ProfileVerificationRequest.VerificationType.IDENTITY_DOCUMENT,
    )
    admin_list = authenticated_client(super_admin).get(
        "/api/v1/admin/verifications/?verification_type=PROFILE_PHOTO"
    )
    assert admin_list.status_code == status.HTTP_200_OK
    assert admin_list.data["data"]["count"] == 1
    assert admin_list.data["data"]["results"][0]["profile_photos"][0]["id"] == photo_id

    bypass = staff_client.post(
        "/api/v1/staff/work-action/",
        {"assignment_id": str(assignment.pk), "action": "complete", "outcome": "APPROVE"},
        format="json",
    )
    assert bypass.status_code == status.HTTP_400_BAD_REQUEST
    assert ProfilePhoto.objects.get(pk=photo_id).status == ProfilePhoto.Status.PENDING

    approved = staff_client.post(
        f"/api/admin/profile-photos/{photo_id}/approve/"
    )
    assert approved.status_code == status.HTTP_200_OK
    verification.refresh_from_db()
    assignment.refresh_from_db()
    assert verification.status == ProfileVerificationRequest.Status.APPROVED
    assert verification.reviewed_at is not None
    assert assignment.status == WorkAssignment.Status.COMPLETED
    assert assignment.completed_at is not None
