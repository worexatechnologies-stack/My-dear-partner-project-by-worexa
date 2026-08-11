"""Private API endpoints for PostgreSQL ``BYTEA`` profile photos."""

from __future__ import annotations

from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AccountType
from apps.core.responses import ApiResponse, ApiErrorResponse

from .models import ProfilePhoto
from .photo_permissions import can_review_profile_photos, can_view_profile_photo
from .serializers import ProfilePhotoSerializer
from .services.image_processing import ProfilePhotoProcessingError
from .services.photo_management import (
    MAX_PROFILE_PHOTOS,
    PrimaryPhotoNotVerifiedError,
    create_profile_photo,
    delete_profile_photo,
    reorder_profile_photos,
    replace_profile_photo,
    review_profile_photo,
    set_primary_profile_photo,
)


def _require_active_member(request):
    user = request.user
    if (
        str(getattr(user, "account_type", "")) != AccountType.MEMBER
        or not getattr(user, "is_active", False)
        or getattr(user, "deleted_at", None) is not None
        or getattr(user, "account_status", None) != "ACTIVE"
    ):
        raise PermissionDenied("An active member account is required.")
    return user


def _require_photo_reviewer(request, photo_id, *, action: str):
    photo = _photo_metadata_or_404(photo_id)
    if not can_review_profile_photos(request.user, photo, action=action):
        raise PermissionDenied("You do not have permission to review profile photos.")
    from apps.core.role_views import check_object_scope

    check_object_scope(request.user, photo.user, branch_path="branch")
    return request.user


def _uploaded_photo(request):
    uploaded = request.FILES.get("photo") or request.FILES.get("image")
    if uploaded is None:
        raise ProfilePhotoProcessingError("Send the image as multipart field 'photo'.")
    return uploaded


def _photo_error_code(message: str) -> str:
    text = (message or "").lower()
    if "already" in text and ("gallery" in text or "uploaded" in text):
        return "DUPLICATE_PHOTO"
    if "maximum" in text or "plan allows" in text or "limit reached" in text or "max " in text or "reached the limit" in text:
        return "PHOTO_LIMIT_REACHED"
    if "dimension" in text or "pixels" in text or "600" in text or "750" in text:
        return "INVALID_FILE"
    if "format" in text or "jpeg" in text or "png" in text or "webp" in text:
        return "INVALID_FILE"
    if "valid" in text or "complete" in text or "identify" in text or "empty" in text:
        return "INVALID_FILE"
    return "INVALID_FILE"


def _error_response(error: Exception, *, field="photo", code: str | None = None):
    code = code or _photo_error_code(str(error))
    return ApiErrorResponse(
        message=str(error),
        code=code,
        errors={field: [str(error)]},
        status=status.HTTP_400_BAD_REQUEST,
        request=None,
    )


def _etag_matches(request, etag: str) -> bool:
    incoming = request.META.get("HTTP_IF_NONE_MATCH", "")
    candidates = {value.strip() for value in incoming.split(",")}
    return "*" in candidates or etag in candidates or f"W/{etag}" in candidates


def _photo_metadata_or_404(photo_id) -> ProfilePhoto:
    """Fetch permission/ETag metadata without either BYTEA value."""
    fields = (
        "id",
        "user_id",
        "status",
        "checksum",
        "mime_type",
        "compressed_size_bytes",
        "thumbnail_size_bytes",
        "is_deleted",
        "user__id",
        "user__is_active",
        "user__deleted_at",
        "user__account_status",
        "user__is_hidden",
        "user__profile_status",
    )
    try:
        return (
            ProfilePhoto.objects.active().without_binary()
            .select_related("user")
            .only(*fields)
            .get(pk=photo_id)
        )
    except ProfilePhoto.DoesNotExist as exc:
        raise Http404("Profile photo not found.") from exc


def _binary_photo_or_404(metadata: ProfilePhoto, field_name: str) -> ProfilePhoto:
    """Fetch one BYTEA column only while the authorized snapshot still matches."""
    try:
        return (
            ProfilePhoto.objects.active().only("id", "mime_type", field_name)
            .get(
                pk=metadata.pk,
                user_id=metadata.user_id,
                status=metadata.status,
                checksum=metadata.checksum,
                user__is_active=metadata.user.is_active,
                user__deleted_at=metadata.user.deleted_at,
                user__account_status=metadata.user.account_status,
                user__is_hidden=metadata.user.is_hidden,
                user__profile_status=metadata.user.profile_status,
            )
        )
    except ProfilePhoto.DoesNotExist as exc:
        raise Http404("Profile photo not found.") from exc


class ProfilePhotoCollectionView(APIView):
    """Create a photo from multipart form data (and list as a convenience)."""

    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (FormParser, MultiPartParser)

    def post(self, request):
        member = _require_active_member(request)
        try:
            photo = create_profile_photo(
                member=member,
                uploaded_file=_uploaded_photo(request),
                actor=member,
            )
        except PrimaryPhotoNotVerifiedError as exc:
            return ApiResponse(
                success=False,
                message=str(exc),
                errors={"code": "PRIMARY_PHOTO_NOT_VERIFIED"},
                status=status.HTTP_403_FORBIDDEN,
            )
        except ProfilePhotoProcessingError as exc:
            return _error_response(exc)

        return ApiResponse(
            data=ProfilePhotoSerializer(photo, context={"request": request}).data,
            message="Photo uploaded successfully.",
            status=status.HTTP_201_CREATED,
        )

    def get(self, request):
        return ProfilePhotoMineView().get(request)


class ProfilePhotoMineView(APIView):
    """Return the owner’s image metadata without either binary column."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        member = _require_active_member(request)
        photos = (
            ProfilePhoto.objects.without_binary()
            .filter(user=member)
            .order_by("display_order", "created_at")
        )
        serialized = ProfilePhotoSerializer(photos, many=True, context={"request": request}).data
        from apps.core.entitlements import get_active_entitlements
        return ApiResponse(
            data={"photos": serialized, "count": len(serialized), "max_photos": get_active_entitlements(member).max_photos},
            message="Profile photos retrieved successfully.",
        )


class ProfilePhotoDetailView(APIView):
    """Replace or delete a member-owned photo."""

    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (FormParser, MultiPartParser, JSONParser)

    def patch(self, request, photo_id):
        member = _require_active_member(request)
        try:
            photo = replace_profile_photo(
                photo_id=photo_id,
                member=member,
                uploaded_file=_uploaded_photo(request),
                actor=member,
            )
        except ProfilePhoto.DoesNotExist as exc:
            raise Http404("Profile photo not found.") from exc
        except ProfilePhotoProcessingError as exc:
            return _error_response(exc)
        return ApiResponse(
            data=ProfilePhotoSerializer(photo, context={"request": request}).data,
            message="Photo replaced successfully.",
        )

    def delete(self, request, photo_id):
        member = _require_active_member(request)
        try:
            replacement = delete_profile_photo(photo_id=photo_id, member=member, actor=member)
        except ProfilePhoto.DoesNotExist as exc:
            raise Http404("Profile photo not found.") from exc
        data = {
            "primary_photo_id": str(replacement.pk) if replacement else None,
            "max_photos": MAX_PROFILE_PHOTOS,
        }
        return ApiResponse(data=data, message="Photo deleted successfully.")


class ProfilePhotoSetPrimaryView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, photo_id):
        member = _require_active_member(request)
        try:
            photo = set_primary_profile_photo(photo_id=photo_id, member=member, actor=member)
        except ProfilePhoto.DoesNotExist as exc:
            raise Http404("Profile photo not found.") from exc
        except ProfilePhotoProcessingError as exc:
            return _error_response(exc, field="detail")
        return ApiResponse(
            data=ProfilePhotoSerializer(photo, context={"request": request}).data,
            message="Primary photo updated successfully.",
        )


class ProfilePhotoReorderView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (JSONParser,)

    def post(self, request):
        member = _require_active_member(request)
        photo_ids = request.data.get("photo_ids")
        if not isinstance(photo_ids, list):
            return Response(
                {"photo_ids": ["Provide an array of photo ids."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            photos = reorder_profile_photos(
                member=member,
                photo_ids=photo_ids,
                actor=member,
            )
        except ProfilePhotoProcessingError as exc:
            return Response(
                {"photo_ids": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST
            )
        return ApiResponse(
            data=ProfilePhotoSerializer(photos, many=True, context={"request": request}).data,
            message="Photos reordered successfully.",
        )


class _ProfilePhotoBinaryView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    binary_field = ""
    etag_suffix = ""

    def _authorized_metadata(self, request, photo_id) -> ProfilePhoto:
        metadata = _photo_metadata_or_404(photo_id)
        if not can_view_profile_photo(request.user, metadata):
            raise PermissionDenied("You are not allowed to view this profile photo.")
        if str(getattr(request.user, "account_type", "")) in {
            AccountType.ADMIN,
            AccountType.SUPER_ADMIN,
        }:
            from apps.core.role_views import check_object_scope

            check_object_scope(request.user, metadata.user, branch_path="branch")
        return metadata

    def _apply_cache_headers(self, response, etag: str, *, status: str):
        response["ETag"] = etag
        if status == ProfilePhoto.Status.APPROVED:
            response["Cache-Control"] = "private, max-age=86400, must-revalidate"
        else:
            response["Cache-Control"] = "private, no-cache, must-revalidate"
        response["Vary"] = "Authorization, Cookie"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def _apply_private_headers(self, response, etag: str):
        """Legacy wrapper for callers that do not pass status."""
        return self._apply_cache_headers(response, etag, status=ProfilePhoto.Status.APPROVED)

    def head(self, request, photo_id):
        """Return validators and stored length without fetching either BYTEA."""
        metadata = self._authorized_metadata(request, photo_id)
        etag = f'"{metadata.checksum}{self.etag_suffix}"'
        if _etag_matches(request, etag):
            response = HttpResponse(status=status.HTTP_304_NOT_MODIFIED)
        else:
            response = HttpResponse(status=status.HTTP_200_OK, content_type=metadata.mime_type)
            size_field = (
                "thumbnail_size_bytes"
                if self.binary_field == "thumbnail_data"
                else "compressed_size_bytes"
            )
            response["Content-Length"] = str(getattr(metadata, size_field))
        return self._apply_cache_headers(response, etag, status=metadata.status)

    def get(self, request, photo_id):
        # Do not fetch a 600 KB BYTEA payload merely to deny a UUID probe.
        # The metadata query intentionally defers both binary columns.
        metadata = self._authorized_metadata(request, photo_id)

        etag = f'"{metadata.checksum}{self.etag_suffix}"'
        if _etag_matches(request, etag):
            response = HttpResponse(status=status.HTTP_304_NOT_MODIFIED)
        else:
            photo = _binary_photo_or_404(metadata, self.binary_field)
            # A reciprocal block can be created independently of the photo
            # row. Recheck immediately before emitting bytes; changed photo or
            # account state also fails closed through the snapshot query above.
            fresh_metadata = _photo_metadata_or_404(photo_id)
            if (
                fresh_metadata.checksum != metadata.checksum
                or fresh_metadata.status != metadata.status
                or not can_view_profile_photo(request.user, fresh_metadata)
            ):
                raise PermissionDenied("You are not allowed to view this profile photo.")
            image_bytes = bytes(getattr(photo, self.binary_field))
            response = HttpResponse(image_bytes, content_type=photo.mime_type)
            response["Content-Length"] = str(len(image_bytes))
        return self._apply_cache_headers(response, etag, status=metadata.status)


class ProfilePhotoImageView(_ProfilePhotoBinaryView):
    binary_field = "image_data"
    etag_suffix = ""


class ProfilePhotoThumbnailView(_ProfilePhotoBinaryView):
    binary_field = "thumbnail_data"
    etag_suffix = "-thumbnail"


class AdminProfilePhotoApproveView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, photo_id):
        reviewer = _require_photo_reviewer(request, photo_id, action="approve")
        try:
            photo = review_profile_photo(photo_id=photo_id, reviewer=reviewer, approve=True)
        except ProfilePhoto.DoesNotExist as exc:
            raise Http404("Profile photo not found.") from exc
        except ProfilePhotoProcessingError as exc:
            return _error_response(exc, field="detail")
        return ApiResponse(
            data=ProfilePhotoSerializer(photo, context={"request": request}).data,
            message="Profile photo approved successfully.",
        )


class AdminProfilePhotoRejectView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (JSONParser,)

    def post(self, request, photo_id):
        reviewer = _require_photo_reviewer(request, photo_id, action="reject")
        try:
            photo = review_profile_photo(
                photo_id=photo_id,
                reviewer=reviewer,
                approve=False,
                reason=str(request.data.get("reason", "")),
            )
        except ProfilePhoto.DoesNotExist as exc:
            raise Http404("Profile photo not found.") from exc
        except ProfilePhotoProcessingError as exc:
            return _error_response(exc, field="reason")
        return ApiResponse(
            data=ProfilePhotoSerializer(photo, context={"request": request}).data,
            message="Profile photo rejected successfully.",
        )


class AdminProfilePhotoDeleteView(APIView):
    """Allow admins to delete any profile photo (including approved ones)."""

    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request, photo_id):
        from apps.core.role_views import check_object_scope

        reviewer = _require_photo_reviewer(request, photo_id, action="approve")
        metadata = _photo_metadata_or_404(photo_id)
        check_object_scope(request.user, metadata.user, branch_path="branch")
        member = metadata.user
        try:
            was_primary = metadata.is_primary
            was_status = metadata.status
            # Soft-delete: keep metadata, null out binary blobs to free space
            ProfilePhoto.objects.filter(pk=metadata.pk).update(
                is_deleted=True,
                deleted_at=timezone.now(),
                image_data=None,
                thumbnail_data=None,
            )
            if was_primary:
                from .services.photo_management import _choose_primary_photo
                _choose_primary_photo(member, exclude_photo_id=metadata.pk)
            from .services.photo_management import _sync_member_photo_status
            _sync_member_photo_status(member)
            from .services.photo_management import _record_audit
            _record_audit(
                photo_id=metadata.pk,
                member_id=member.pk,
                actor=reviewer,
                action="DELETED",
                details={
                    "deleted_by": "admin",
                    "soft_delete": True,
                    "was_primary": was_primary,
                    "was_status": was_status,
                },
            )
            from .services.photo_management import _invalidate_profile_caches
            _invalidate_profile_caches(member.pk)
            from apps.notifications.services import send_event_after_commit
            send_event_after_commit(
                groups=("role_super_admin", "role_admin", "role_staff"),
                event_type="photo.deleted",
                entity="member_photo",
                entity_id=metadata.pk,
                message=f"Photo deleted by admin for {member.get_full_name()}",
                data={
                    "member_id": str(member.pk),
                    "member_name": member.get_full_name(),
                    "photo_id": str(metadata.pk),
                    "was_primary": was_primary,
                    "was_status": was_status,
                    "deleted_by": "admin",
                    "soft_delete": True,
                },
            )
            from apps.core.api_utils import notify
            notify(
                member,
                notification_type="PROFILE_PHOTO_DELETED",
                title="Photo removed",
                message="An administrator has removed one of your profile photos.",
                related_object_id=str(metadata.pk),
                priority="HIGH",
            )
        except ProfilePhoto.DoesNotExist as exc:
            raise Http404("Profile photo not found.") from exc
        return ApiResponse(message="Profile photo deleted successfully by admin.")


# Backwards-compatible class names and paths used while the Next app migrates.
class ProfilePhotoUploadView(ProfilePhotoCollectionView):
    pass


class ProfilePhotoListView(ProfilePhotoMineView):
    pass


class ProfilePhotoDeleteView(ProfilePhotoDetailView):
    pass


class UserProfileImageUploadView(APIView):
    """Compatibility endpoint for registration clients using ``images``.

    Every upload is stored through the canonical ProfilePhoto pipeline.  The
    retired UserProfileImage table has no moderation state and must never
    receive new uploads.
    """

    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        member = _require_active_member(request)

        # Support multiple files uploaded as 'images', 'image', or 'photo'
        files = request.FILES.getlist("images") or request.FILES.getlist("image") or request.FILES.getlist("photo")
        if not files:
            single_file = request.FILES.get("images") or request.FILES.get("image") or request.FILES.get("photo")
            if single_file:
                files = [single_file]

        if not files:
            return Response(
                {"detail": "No images provided."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.core.entitlements import get_active_entitlements
        existing_count = ProfilePhoto.objects.filter(user=member).count()
        incoming_count = len(files)
        max_photos = get_active_entitlements(member).max_photos
        if existing_count + incoming_count > max_photos:
            return Response(
                {"error": "ENTITLEMENT_DENIED", "entitlement": "max_photos", "current_plan": get_active_entitlements(member).plan_name, "upgrade_url": "/membership"},
                status=status.HTTP_403_FORBIDDEN,
            )
        saved_photos = []
        try:
            for file in files:
                saved_photos.append(create_profile_photo(
                    member=member,
                    uploaded_file=file,
                    actor=member,
                ))
        except PrimaryPhotoNotVerifiedError as exc:
            return ApiErrorResponse(
                message=str(exc),
                code="PRIMARY_PHOTO_NOT_VERIFIED",
                errors={"code": ["PRIMARY_PHOTO_NOT_VERIFIED"]},
                status=status.HTTP_403_FORBIDDEN,
                request=None,
            )
        except ProfilePhotoProcessingError as exc:
            return _error_response(exc)

        return Response(
            {
                "success": True,
                "message": "Photo uploaded and submitted for approval.",
                "data": ProfilePhotoSerializer(saved_photos, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class UserAvatarView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, user_id):
        from .models import UserProfileImage
        avatar = UserProfileImage.objects.filter(user_id=user_id).order_by("display_order", "created_at").first()
        
        if avatar and avatar.thumbnail_data:
            response = HttpResponse(bytes(avatar.thumbnail_data), content_type=avatar.mime_type)
            response["Content-Length"] = str(len(avatar.thumbnail_data))
            response["Cache-Control"] = "public, max-age=86400"
            return response
            
        # Fallback to existing ProfilePhoto primary approved thumbnail
        from .models import ProfilePhoto
        old_photo = ProfilePhoto.objects.filter(user_id=user_id, is_primary=True, status=ProfilePhoto.Status.APPROVED).first()
        if old_photo and old_photo.thumbnail_data:
            response = HttpResponse(bytes(old_photo.thumbnail_data), content_type=old_photo.mime_type)
            response["Content-Length"] = str(len(old_photo.thumbnail_data))
            response["Cache-Control"] = "public, max-age=86400"
            return response

        # Default placeholder SVG
        default_svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>'
            '<circle cx="12" cy="7" r="4"></circle>'
            '</svg>'
        )
        response = HttpResponse(default_svg, content_type="image/svg+xml")
        response["Cache-Control"] = "public, max-age=86400"
        return response
