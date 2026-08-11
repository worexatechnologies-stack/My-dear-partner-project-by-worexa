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
