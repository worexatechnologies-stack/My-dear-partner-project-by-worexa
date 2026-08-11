import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class MembershipSubscription(models.Model):
    class PlanName(models.TextChoices):
        GOLD = "Gold", "Gold"
        PLATINUM = "Platinum", "Platinum"
        ELITE = "Elite", "Elite"

    class PlanSlug(models.TextChoices):
        GOLD = "gold", "gold"
        PLATINUM = "platinum", "platinum"
        ELITE = "elite", "elite"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    plan_name = models.CharField(max_length=20, choices=PlanName.choices)
    plan_slug = models.CharField(max_length=20, choices=PlanSlug.choices, db_index=True)
    views_limit = models.PositiveIntegerField()
    views_used = models.PositiveIntegerField(default=0)
    end_date = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "membership_subscriptions"
        ordering = ("-end_date", "-created_at")
        indexes = [models.Index(fields=("user", "end_date"), name="membership_sub_user_end_idx")]

    @property
    def is_active(self):
        return self.end_date > timezone.now()

    def __str__(self):
        return f"{self.user_id}: {self.plan_name}"
