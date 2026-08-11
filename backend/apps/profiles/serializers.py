"""JSON serializers for profiles and photo metadata.

Binary fields are intentionally absent from every serializer in this module.
Clients receive secure endpoint URLs and request the raw WebP separately.
"""

from __future__ import annotations

from datetime import date

from rest_framework import serializers

from apps.accounts.models import MemberProfile

from .models import ProfilePhoto


PHOTO_API_PREFIX = "/api/profile-photos"


def photo_endpoint_urls(photo: ProfilePhoto) -> dict[str, str]:
    base = f"{PHOTO_API_PREFIX}/{photo.pk}"
    version = photo_version(photo)
    return {
        "image_url": f"{base}/image/?v={version}",
        "thumbnail_url": f"{base}/thumbnail/?v={version}",
    }


def photo_version(photo: ProfilePhoto) -> str:
    # Microseconds makes a replacement cache-bust reliable even when two writes
    # happen during the same second.
    return str(int(photo.updated_at.timestamp() * 1_000_000))


def photo_metadata(photo: ProfilePhoto) -> dict:
    """A compact, binary-free representation reusable outside DRF serializers."""
    urls = photo_endpoint_urls(photo)
    return {
        "id": str(photo.pk),
        **urls,
        "url": urls["image_url"],  # compatibility for legacy consumers
        "is_primary": photo.is_primary,
        "status": photo.status,
        "display_order": photo.display_order,
        "rejection_reason": photo.rejection_reason or None,
        "width": photo.width,
        "height": photo.height,
        "thumbnail_width": photo.thumbnail_width,
        "thumbnail_height": photo.thumbnail_height,
        "compressed_size_bytes": photo.compressed_size_bytes,
        "thumbnail_size_bytes": photo.thumbnail_size_bytes,
        "updated_at": photo.updated_at.isoformat(),
        "version": photo_version(photo),
    }


class ProfilePhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()

    class Meta:
        model = ProfilePhoto
        fields = (
            "id",
            "image_url",
            "thumbnail_url",
            "url",
            "is_primary",
            "status",
            "display_order",
            "rejection_reason",
            "width",
            "height",
            "thumbnail_width",
            "thumbnail_height",
            "compressed_size_bytes",
            "thumbnail_size_bytes",
            "updated_at",
            "version",
        )
        read_only_fields = fields

    def get_image_url(self, obj):
        return photo_endpoint_urls(obj)["image_url"]

    def get_thumbnail_url(self, obj):
        return photo_endpoint_urls(obj)["thumbnail_url"]

    def get_url(self, obj):
        return self.get_image_url(obj)

    def get_version(self, obj):
        return photo_version(obj)


def age_for(date_of_birth):
    if not date_of_birth:
        return None
    today = date.today()
    return today.year - date_of_birth.year - (
        (today.month, today.day) < (date_of_birth.month, date_of_birth.day)
    )


class MemberProfileSummarySerializer(serializers.Serializer):
    """Serialize profile data without loading photo BYTEA columns."""

    id = serializers.UUIDField(source="pk", read_only=True)
    user_id = serializers.UUIDField(source="pk", read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    gender = serializers.CharField(read_only=True)
    date_of_birth = serializers.DateField(read_only=True)
    age = serializers.SerializerMethodField()
    marital_status = serializers.SerializerMethodField()
    religion = serializers.SerializerMethodField()
    mother_tongue = serializers.SerializerMethodField()
    caste = serializers.SerializerMethodField()
    highest_education = serializers.SerializerMethodField()
    occupation = serializers.SerializerMethodField()
    annual_income = serializers.SerializerMethodField()
    work_location = serializers.SerializerMethodField()
    compatibility_score = serializers.SerializerMethodField()
    primary_photo = serializers.SerializerMethodField()

    def _profile(self, member):
        try:
            return member.profile
        except MemberProfile.DoesNotExist:
            return None

    def _value(self, member, field, default=""):
        profile = self._profile(member)
        return getattr(profile, field, default) if profile else default

    def get_age(self, member):
        return age_for(member.date_of_birth)

    def get_marital_status(self, member):
        return self._value(member, "marital_status")

    def get_religion(self, member):
        return self._value(member, "religion")

    def get_mother_tongue(self, member):
        return self._value(member, "mother_tongue")

    def get_caste(self, member):
        return self._value(member, "caste")

    def get_highest_education(self, member):
        return self._value(member, "highest_education")

    def get_occupation(self, member):
        return self._value(member, "occupation")

    def get_annual_income(self, member):
        return self._value(member, "annual_income")

    def get_work_location(self, member):
        return self._value(member, "work_location")

    def get_compatibility_score(self, member):
        return self._value(member, "compatibility", 75)

    @staticmethod
    def _approved_photos(member):
        """Use a byte-deferred prefetch when the caller supplied one."""
        prefetched = getattr(member, "_prefetched_objects_cache", {}).get("profile_photos")
        if prefetched is not None:
            return sorted(
                (
                    photo
                    for photo in prefetched
                    if photo.status == ProfilePhoto.Status.APPROVED and not photo.is_deleted
                ),
                key=lambda photo: (photo.display_order, photo.created_at),
            )
        return list(
            ProfilePhoto.objects.active().without_binary()
            .filter(user=member, status=ProfilePhoto.Status.APPROVED)
            .order_by("display_order", "created_at")
        )

    def get_primary_photo(self, member):
        photos = self._approved_photos(member)
        photo = next((item for item in photos if item.is_primary), None)
        return ProfilePhotoSerializer(photo, context=self.context).data if photo else None


class MemberProfileDetailSerializer(MemberProfileSummarySerializer):
    about = serializers.SerializerMethodField()
    hobbies = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()

    def get_about(self, member):
        return self._value(member, "about")

    def get_hobbies(self, member):
        hobbies = self._value(member, "hobbies", [])
        return hobbies if isinstance(hobbies, list) else []

    def get_photos(self, member):
        photos = self._approved_photos(member)[:6]
        return ProfilePhotoSerializer(photos, many=True, context=self.context).data


class HobbiesInputSerializer(serializers.Serializer):
    hobbies = serializers.ListField(
        child=serializers.CharField(max_length=80, trim_whitespace=True),
        max_length=20,
    )

    def validate_hobbies(self, value):
        cleaned = [item.strip() for item in value]
        if any(not item for item in cleaned):
            raise serializers.ValidationError("Hobbies must contain non-empty strings.")
        return cleaned
