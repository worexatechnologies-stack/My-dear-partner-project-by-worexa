from django.urls import path

from .views import (
    InterestDetailView,
    InterestListCreateView,
    PassListView,
    ProfileBlockView,
    ShortlistView,
)


urlpatterns = [
    path("blocks/", ProfileBlockView.as_view(), name="profile-blocks"),
    path("blocks/<uuid:member_id>/", ProfileBlockView.as_view(), name="profile-block-detail"),
    path("shortlists/", ShortlistView.as_view(), name="contract-shortlists"),
    path("passes/", PassListView.as_view(), name="contract-passes"),
    path("passes/<uuid:profile_id>/", PassListView.as_view(), name="contract-pass-detail"),
    path("interests/", InterestListCreateView.as_view(), name="contract-interests"),
    path("interests/<uuid:pk>/", InterestDetailView.as_view(), name="contract-interest-detail"),
]

