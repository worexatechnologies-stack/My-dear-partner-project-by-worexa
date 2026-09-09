import logging
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Device
from .push import send_chat_push, send_interest_push

logger = logging.getLogger(__name__)


class DeviceRegistrationView(APIView):
    """
    POST /api/v1/devices/
    Register or update an FCM device token for push notifications.
    Request body:
    {
        "token": "FCM_TOKEN",
        "platform": "android" or "ios"
    }

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
                status=status.HTTP_400_BAD_REQUEST,
            )

        if platform not in ("ios", "android"):
            user_agent = request.META.get("HTTP_USER_AGENT", "").lower()
            platform = "ios" if any(k in user_agent for k in ("iphone", "ipad", "darwin")) else "android"

        device, created = Device.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "platform": platform,
                "active": True,
            },
        )
        logger.info(
            "Device token registered for user %s: platform=%s, created=%s, token=%s...",
            request.user.pk,
            platform,
            created,
            token[:15],
        )
        return Response(
            {
                "success": True,
                "message": "Device registered successfully",
                "data": {
                    "token": token,
                    "platform": platform,
                    "active": device.active,
                    "user_id": request.user.pk,
                },
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, token=None):
        target_token = token or request.data.get("token")
        if not target_token:
            return Response(
                {"success": False, "message": "token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_token = str(target_token).strip()
        deleted_count, _ = Device.objects.filter(user=request.user, token=target_token).delete()
        logger.info(
            "Device token removed for user %s: token=%s... count=%s",
            request.user.pk,
            target_token[:15],
            deleted_count,
        )
        return Response({
            "success": True,
            "message": "Device unregistered successfully",
            "deleted_count": deleted_count,
        })


class TestPushNotificationView(APIView):
    """
    POST /api/v1/devices/test-push/
    Development and administrative endpoint to test sending push notifications.
    Request body:
    {
        "token": "FCM_DEVICE_TOKEN",
        "type": "chat" | "interest",
        "title": "Optional Title",
        "body": "Optional Body"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = str(request.data.get("token", "")).strip()
        push_type = str(request.data.get("type", "chat")).lower().strip()
        title = request.data.get("title")
        body = request.data.get("body")

        if not token:
            # If token is not provided in body, try using the user's latest active token
            dev = Device.objects.filter(user=request.user, active=True).order_by("-updated_at").first()
            if dev:
                token = dev.token
            else:
                return Response(
                    {"success": False, "message": "token is required (no active registered device found for user)"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        logger.info(
            "Triggering test %s push for user %s to token=%s...",
            push_type,
            request.user.pk,
            token[:15],
        )

        try:
            if push_type == "interest":
                msg_id = send_interest_push(
                    device=token,
                    sender_name="Test Sender",
                    interest_id="test-interest-001",
                    sender_id=str(request.user.pk),
                    receiver_id=str(request.user.pk),
                    title=title or "New Interest",
                    body=body or "Someone sent you an interest",
                )
            else:
                msg_id = send_chat_push(
                    device=token,
                    sender_name="Test Sender",
                    message_id="test-msg-001",
                    conversation_id="test-conv-001",
                    sender_id=str(request.user.pk),
                    receiver_id=str(request.user.pk),
                    title=title or "New message",
                    body=body or "You have a new message",
                )

            if msg_id:
                return Response({
                    "success": True,
                    "message": "Test push notification sent successfully",
                    "data": {
                        "message_id": msg_id,
                        "token": token,
                        "type": push_type,
                    },
                })
            else:
                return Response({
                    "success": False,
                    "message": "Push notification dispatch failed or credentials not configured. Check backend logs.",
                }, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as exc:
            logger.exception("Error in TestPushNotificationView: %s", exc)
            return Response({
                "success": False,
                "message": f"Failed to send test push: {exc}",
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

