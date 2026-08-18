"""
Presence API views.

Exposes a targeted, non-broadcasting presence lookup so the frontend can check
online status for only the profiles currently visible on screen (search
results, chat participants, matches). This avoids broadcasting every
online/offline transition to all connected users.
"""

from rest_framework import permissions, status
from rest_framework.views import APIView

from apps.accounts.presence import get_bulk_status, get_last_seen_map
from apps.accounts.presence_access import authorized_presence_member_ids
from apps.core.responses import ApiResponse


class PresenceBulkView(APIView):
    """
    POST /api/v1/presence/bulk/

    Body: { "user_ids": ["uuid-1", "uuid-2", ...] }
    Response: {
        "uuid-1": "ONLINE",
        "uuid-2": "OFFLINE",
        ...,
        "last_seen_at": { "uuid-1": "2026-08-10T12:00:00+00:00", "uuid-2": null, ... }
    }

    The flat user_id -> status map is kept for backward compatibility; the
    ``last_seen_at`` sibling only adds durable info for OFFLINE users.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        raw_ids = request.data.get("user_ids")
        if not isinstance(raw_ids, list) or not raw_ids:
            return ApiResponse(
                success=False,
                message="user_ids must be a non-empty array.",
                status=status.HTTP_400_BAD_REQUEST,
            )

        # The caller can only ask about accepted, unblocked matches. Returning
        # an empty map for all other IDs avoids turning presence into a member
        # enumeration endpoint.
        user_ids = authorized_presence_member_ids(request.user, raw_ids)
        if not user_ids:
            return ApiResponse(
                data={"last_seen_at": {}},
                status=status.HTTP_200_OK,
            )

        status_map = get_bulk_status(user_ids)
        last_seen_map = get_last_seen_map(user_ids)
        data = dict(status_map)
        data["last_seen_at"] = last_seen_map
        return ApiResponse(data=data, status=status.HTTP_200_OK)
