from django.urls import path

from .views import InterestListCreateView, ShortlistView


urlpatterns = [
    path("shortlists/", ShortlistView.as_view(), name="contract-shortlists"),
    path("interests/", InterestListCreateView.as_view(), name="contract-interests"),
]
