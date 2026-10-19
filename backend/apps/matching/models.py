import uuid

from django.conf import settings
from django.db import models

from apps.core.models import Interest


class MemberInterest(Interest):
    """Public contract name for the established interest table."""

    class Meta:
        proxy = True
        verbose_name = "member interest"
        verbose_name_plural = "member interests"


class MemberShortlist(models.Model):
    """A member's saved profile.

    The existing member-profile table has an integer primary key, while the
    public API exposes the owning member UUID as a profile identifier.  Views
    resolve that UUID before creating this relationship.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="member_shortlists",
    )
    profile = models.ForeignKey(
        "accounts.MemberProfile",
        on_delete=models.CASCADE,
        related_name="shortlisted_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "member_shortlists"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("user", "profile"),
                name="unique_member_shortlist",
            )
        ]

    def __str__(self):
        return f"{self.user_id} shortlisted {self.profile_id}"


class MemberPass(models.Model):
    """A member's passed / disliked profile from Discover."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="member_passes",
    )
    profile = models.ForeignKey(
        "accounts.MemberProfile",
        on_delete=models.CASCADE,
        related_name="passed_by_members",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "member_passes"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("user", "profile"),
                name="unique_member_pass",
            )
        ]

    def __str__(self):
        return f"{self.user_id} passed {self.profile_id}"


class ProfileCompatibilityRecord(models.Model):
    """Personalized bidirectional compatibility score and AI insights cache."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="compatibility_evaluations_as_viewer",
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="compatibility_evaluations_as_candidate",
    )
    compatibility_score = models.PositiveSmallIntegerField(default=0)
    confidence = models.CharField(max_length=20, default="medium")  # high, medium, low
    data_completeness = models.PositiveSmallIntegerField(default=0)
    shared_strengths = models.JSONField(default=list, blank=True)
    considerations = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True, default="")
    explanation = models.TextField(blank=True, default="")
    factors = models.JSONField(default=dict, blank=True)
    ai_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "profile_compatibility_records"
        indexes = [
            models.Index(fields=["viewer", "candidate"], name="compat_viewer_candidate_idx"),
            models.Index(fields=["viewer", "-updated_at"], name="compat_viewer_updated_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("viewer", "candidate"),
                name="unique_viewer_candidate_compat",
            )
        ]

    def __str__(self):
        return f"Compatibility {self.viewer_id} <-> {self.candidate_id}: {self.compatibility_score}%"

