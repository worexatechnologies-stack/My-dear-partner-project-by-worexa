from rest_framework import serializers

from .models import MembershipSubscription


class MembershipSubscriptionSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = MembershipSubscription
        fields = (
            "id",
            "plan_name",
            "plan_slug",
            "views_limit",
            "views_used",
            "end_date",
            "is_active",
        )
        read_only_fields = fields
