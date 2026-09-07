import logging
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Device

logger = logging.getLogger(__name__)


class DeviceRegistrationView(APIView):
    """
    POST /api/v1/devices/
    Register or update an FCM device token for push notifications.

    DELETE /api/v1/devices/<token>/
    or DELETE /api/v1/devices/ with body {"token": "..."}
    Unregister an FCM device token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = str(request.data.get("token", "")).strip()
        platform = str(request.data.get("platform", "")).lower().strip()

        if not token:
            return Response(
                {"success": False, "message": "token is required"},
                status=400,
            )

        if platform not in ("ios", "android"):
            user_agent = request.META.get("HTTP_USER_AGENT", "").lower()
            platform = "ios" if "iphone" in user_agent or "ipad" in user_agent or "darwin" in user_agent else "android"

        device, created = Device.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "platform": platform,
            },
        )
        logger.info(
            "Device token registered for user %s: platform=%s, created=%s",
            request.user.pk,
            platform,
            created,
        )
        return Response(
            {
                "success": True,
                "message": "Device registered successfully",
                "data": {
                    "token": token,
                    "platform": platform,
                },
            }
        )

    def delete(self, request, token=None):
        target_token = token or request.data.get("token")
        if target_token:
            deleted_count, _ = Device.objects.filter(user=request.user, token=target_token).delete()
            logger.info("Device token removed for user %s: count=%s", request.user.pk, deleted_count)
        return Response({"success": True, "message": "Device unregistered successfully"})
