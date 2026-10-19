from django.urls import path

from .views import (
    CompatibilityDetailView,
    CompatibilityRecalculateView,
    InterestDetailView,
    InterestListCreateView,
    PassListView,
    ProfileBlockView,
    RecommendedMatchesView,
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
    path("compatibility/", CompatibilityDetailView.as_view(), name="matching-compatibility"),
    path("compatibility/<uuid:candidate_id>/", CompatibilityDetailView.as_view(), name="matching-compatibility-detail"),
    path("recalculate/", CompatibilityRecalculateView.as_view(), name="matching-recalculate"),
    path("recommended/", RecommendedMatchesView.as_view(), name="matching-recommended"),
]

