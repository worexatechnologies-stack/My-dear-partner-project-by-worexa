from django.contrib import admin

from .models import ProfilePhoto, ProfilePhotoAuditLog


@admin.register(ProfilePhoto)
class ProfilePhotoAdmin(admin.ModelAdmin):
    """Never render BYTEA columns in the Django admin list/queryset."""

    list_display = (
        "id",
        "user",
        "status",
        "is_primary",
        "display_order",
        "compressed_size_bytes",
        "thumbnail_size_bytes",
        "updated_at",
    )
    list_filter = ("status", "is_primary")
    search_fields = ("id", "user__email", "checksum")
    readonly_fields = (
        "id",
        "checksum",
        "original_size_bytes",
        "compressed_size_bytes",
        "thumbnail_size_bytes",
        "width",
        "height",
        "thumbnail_width",
        "thumbnail_height",
        "created_at",
        "updated_at",
    )

    def get_queryset(self, request):
        return super().get_queryset(request).without_binary()


@admin.register(ProfilePhotoAuditLog)
class ProfilePhotoAuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "photo_id", "member_id", "actor_type", "created_at")
    list_filter = ("action", "actor_type")
    search_fields = ("photo_id", "member_id", "actor_id")
    readonly_fields = (
        "id",
        "photo_id",
        "member_id",
        "actor_id",
        "actor_type",
        "action",
        "details",
        "created_at",
    )

    def has_add_permission(self, request):
        return False
