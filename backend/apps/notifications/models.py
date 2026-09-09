from django.conf import settings
from django.db import models


class Device(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="devices",
    )
    token = models.CharField(max_length=512, unique=True)
    platform = models.CharField(max_length=10, default="android")
    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notification_devices"
        verbose_name = "Device"
        verbose_name_plural = "Devices"
        indexes = [
            models.Index(fields=["user", "platform"]),
            models.Index(fields=["user", "active"]),
        ]

    def __str__(self):
        return f"{self.user_id} - {self.platform}"
