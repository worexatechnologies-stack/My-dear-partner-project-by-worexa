"""Database-backed profile photo models.

Profile images are deliberately kept out of ``Member`` and ``MemberProfile``.
The compressed WebP payloads live in this dedicated table as PostgreSQL
``BYTEA`` columns, while normal API queries use ``without_binary()`` so they
do not accidentally pull image blobs into list, matching, or chat queries.
"""

from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q


class ProfilePhotoQuerySet(models.QuerySet):
    """Query helpers that make binary-column avoidance explicit."""

    def without_binary(self):
        return self.defer("image_data", "thumbnail_data")

    def active(self):
        return self.filter(is_deleted=False)


class ProfilePhotoManager(models.Manager.from_queryset(ProfilePhotoQuerySet)):
    """Default manager. Use .active() to exclude soft-deleted photos."""

    def get_queryset(self):
        return ProfilePhotoQuerySet(self.model, using=self._db)

    def without_binary(self):
        return self.get_queryset().defer("image_data", "thumbnail_data")


class ProfilePhoto(models.Model):
    """A compressed profile photo and its thumbnail, stored in PostgreSQL."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "accounts.Member",
        on_delete=models.CASCADE,
        related_name="profile_photos",
    )

    # These become BYTEA columns on PostgreSQL.  They are never serialized in
    # normal JSON responses; image endpoints fetch exactly one of them.
    image_data = models.BinaryField()
    thumbnail_data = models.BinaryField()
    mime_type = models.CharField(max_length=50, default="image/webp")

    original_filename = models.CharField(max_length=255, blank=True)
    original_size_bytes = models.PositiveBigIntegerField()
    compressed_size_bytes = models.PositiveBigIntegerField()
    thumbnail_size_bytes = models.PositiveBigIntegerField()

    width = models.PositiveIntegerField(default=1200)
    height = models.PositiveIntegerField(default=1500)
    thumbnail_width = models.PositiveIntegerField(default=240)
    thumbnail_height = models.PositiveIntegerField(default=300)

    # SHA-256 of the final main WebP.  It is used for duplicate detection and
    # ETags without reading the BLOB in normal queries.
    checksum = models.CharField(max_length=64, db_index=True)

    is_primary = models.BooleanField(default=False)
    display_order = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True)

    # Authentication is intentionally split between Member, Admin, Staff, and
    # SuperAdmin tables in this project.  Separate nullable actor references
    # retain database integrity for the reviewer instead of incorrectly using
    # AUTH_USER_MODEL (which is Member only) for staff/admin reviewers.
    verified_by_admin = models.ForeignKey(
        "accounts.Admin",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_profile_photos",
    )
    verified_by_staff = models.ForeignKey(
        "accounts.Staff",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_profile_photos",
    )
    verified_by_super_admin = models.ForeignKey(
        "accounts.SuperAdmin",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_profile_photos",
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # Soft-delete support.  Member-initiated deletes are hard (bytes freed);
    # admin-initiated deletes soft-delete to preserve audit metadata.
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ProfilePhotoManager()

    class Meta:
        db_table = "profile_photos"
        ordering = ["display_order", "created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["user", "is_primary"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(is_primary=True),
                name="one_primary_profile_photo_per_user",
            ),
        ]

    def __str__(self) -> str:
        return f"Photo {self.id} for member {self.user_id}"

    @property
    def compression_ratio(self) -> float:
        if not self.original_size_bytes:
            return 0.0
        return (1 - self.compressed_size_bytes / self.original_size_bytes) * 100

    @property
    def total_storage_bytes(self) -> int:
        return self.compressed_size_bytes + self.thumbnail_size_bytes

    @property
    def verified_by(self):
        """Return the one administrative reviewer, if the photo has one."""
        return (
            self.verified_by_super_admin
            or self.verified_by_admin
            or self.verified_by_staff
        )


class ProfilePhotoAuditLog(models.Model):
    """Metadata-only audit trail; it never retains image binary data."""

    class Action(models.TextChoices):
        UPLOADED = "UPLOADED", "Uploaded"
        REPLACED = "REPLACED", "Replaced"
        DELETED = "DELETED", "Deleted"
        SET_PRIMARY = "SET_PRIMARY", "Set primary"
        REORDERED = "REORDERED", "Reordered"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        LEGACY_SOURCE_PURGED = "LEGACY_SOURCE_PURGED", "Legacy source purged"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # UUIDs are retained rather than FKs so deletion remains auditable without
    # retaining the deleted image or forcing account retention.
    photo_id = models.UUIDField(db_index=True)
    member_id = models.UUIDField(db_index=True)
    actor_id = models.UUIDField(null=True, blank=True, db_index=True)
    actor_type = models.CharField(max_length=30, blank=True)
    action = models.CharField(max_length=20, choices=Action.choices, db_index=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "profile_photo_audit_logs"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["member_id", "created_at"])]

    def __str__(self) -> str:
        return f"{self.action} profile photo {self.photo_id}"


class UserProfileImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "accounts.Member",
        on_delete=models.CASCADE,
        related_name="user_profile_images",
    )
    image_data = models.BinaryField()
    thumbnail_data = models.BinaryField()
    mime_type = models.CharField(max_length=50, default="image/webp")
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_profile_images"
        ordering = ["display_order", "created_at"]

    def __str__(self) -> str:
        return f"Image {self.id} for user {self.user_id}"

