from rest_framework import serializers

from apps.core.models import Interest
from apps.profiles.serializers import MemberProfileSummarySerializer


class MemberInterestSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    receiver = serializers.SerializerMethodField()

    class Meta:
        model = Interest
        fields = ("id", "sender", "receiver", "status", "created_at")

    def get_sender(self, obj):
        return MemberProfileSummarySerializer(obj.sender, context=self.context).data

    def get_receiver(self, obj):
        return MemberProfileSummarySerializer(obj.receiver, context=self.context).data
