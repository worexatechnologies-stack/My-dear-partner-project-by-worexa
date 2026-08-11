"""Routes for private PostgreSQL-backed profile photos."""

from django.urls import path

from .views import (
    AdminProfilePhotoApproveView,
    AdminProfilePhotoDeleteView,
    AdminProfilePhotoRejectView,
    ProfilePhotoCollectionView,
    ProfilePhotoDeleteView,
    ProfilePhotoDetailView,
    ProfilePhotoImageView,
    ProfilePhotoListView,
    ProfilePhotoMineView,
    ProfilePhotoReorderView,
    ProfilePhotoSetPrimaryView,
    ProfilePhotoThumbnailView,
    ProfilePhotoUploadView,
    UserProfileImageUploadView,
    UserAvatarView,
)

app_name = "profiles"

urlpatterns = [
    path("user-profile-images/", UserProfileImageUploadView.as_view(), name="user-profile-image-upload"),
    path("users/<uuid:user_id>/avatar/", UserAvatarView.as_view(), name="user-avatar"),
    # Canonical API.  The project mounts this under both /api/ and /api/v1/
    # during the frontend transition, but response URLs use the canonical /api/
    # form so clients have one stable secure image location.
    path("profile-photos/", ProfilePhotoCollectionView.as_view(), name="photo-collection"),
    path("profile-photos/mine/", ProfilePhotoMineView.as_view(), name="photo-mine"),
    path("profile-photos/reorder/", ProfilePhotoReorderView.as_view(), name="photo-reorder"),
    path(
        "profile-photos/<uuid:photo_id>/set-primary/",
        ProfilePhotoSetPrimaryView.as_view(),
        name="photo-set-primary",
    ),
    path(
        "profile-photos/<uuid:photo_id>/image/",
        ProfilePhotoImageView.as_view(),
        name="photo-image",
    ),
    path(
        "profile-photos/<uuid:photo_id>/thumbnail/",
        ProfilePhotoThumbnailView.as_view(),
        name="photo-thumbnail",
    ),
    path("profile-photos/<uuid:photo_id>/", ProfilePhotoDetailView.as_view(), name="photo-detail"),
    path(
        "admin/profile-photos/<uuid:photo_id>/approve/",
        AdminProfilePhotoApproveView.as_view(),
        name="admin-photo-approve",
    ),
    path(
        "admin/profile-photos/<uuid:photo_id>/reject/",
        AdminProfilePhotoRejectView.as_view(),
        name="admin-photo-reject",
    ),
    path(
        "admin/profile-photos/<uuid:photo_id>/",
        AdminProfilePhotoDeleteView.as_view(),
        name="admin-photo-delete",
    ),

    # Legacy aliases.  They point to the same BYTEA-only implementation and
    # exist only to avoid a flag-day rollout for existing clients.
    path("member-auth/profile-photos/", ProfilePhotoListView.as_view(), name="legacy-photo-list"),
    path(
        "member-auth/profile-photos/upload/",
        ProfilePhotoUploadView.as_view(),
        name="legacy-photo-upload",
    ),
    path(
        "member-auth/profile-photos/reorder/",
        ProfilePhotoReorderView.as_view(),
        name="legacy-photo-reorder",
    ),
    path(
        "member-auth/profile-photos/<uuid:photo_id>/set-primary/",
        ProfilePhotoSetPrimaryView.as_view(),
        name="legacy-photo-set-primary",
    ),
    path(
        "member-auth/profile-photos/<uuid:photo_id>/",
        ProfilePhotoDeleteView.as_view(),
        name="legacy-photo-delete",
    ),
]
