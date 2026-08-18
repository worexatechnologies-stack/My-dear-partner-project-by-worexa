"""Authorization helpers for targeted member presence."""

from __future__ import annotations

from uuid import UUID

from django.db.models import Q

from apps.accounts.models import AccountType, Member
from apps.core.models import Interest, ProfileBlock


def authorized_presence_member_ids(viewer, requested_ids) -> list[str]:
    """Return only active, unblocked accepted matches visible to ``viewer``.

    Presence is relationship metadata. A client may ask about many IDs, but it
    must never use either the HTTP endpoint or a WebSocket subscription to
    discover whether an unrelated member is online.
    """
    if (
        not viewer
        or str(getattr(viewer, "account_type", "")) != AccountType.MEMBER
        or not getattr(viewer, "is_active", False)
        or getattr(viewer, "deleted_at", None) is not None
    ):
        return []

    normalized_ids: list[str] = []
    seen: set[str] = set()
    for value in list(requested_ids or ())[:200]:
        try:
            member_id = str(UUID(str(value)))
        except (TypeError, ValueError, AttributeError):
            continue
        if member_id != str(viewer.pk) and member_id not in seen:
            seen.add(member_id)
            normalized_ids.append(member_id)

    if not normalized_ids:
        return []

    candidate_ids = set(
        str(member_id)
        for member_id in Member.objects.filter(
            pk__in=normalized_ids,
            is_active=True,
            deleted_at__isnull=True,
            account_status=Member.AccountStatus.ACTIVE,
            is_hidden=False,
        ).values_list("pk", flat=True)
    )
    if not candidate_ids:
        return []

    accepted_pairs = Interest.objects.filter(
        status=Interest.Status.ACCEPTED,
        match_closure__isnull=True,
    ).filter(
        Q(sender_id=viewer.pk, receiver_id__in=candidate_ids)
        | Q(receiver_id=viewer.pk, sender_id__in=candidate_ids)
    ).values_list("sender_id", "receiver_id")
    connected_ids = {
        str(receiver_id if str(sender_id) == str(viewer.pk) else sender_id)
        for sender_id, receiver_id in accepted_pairs
    }

    blocked_pairs = ProfileBlock.objects.filter(
        Q(blocker_id=viewer.pk, blocked_id__in=candidate_ids)
        | Q(blocked_id=viewer.pk, blocker_id__in=candidate_ids)
    ).values_list("blocker_id", "blocked_id")
    blocked_ids = {
        str(blocked_id if str(blocker_id) == str(viewer.pk) else blocker_id)
        for blocker_id, blocked_id in blocked_pairs
    }

    return [
        member_id
        for member_id in normalized_ids
        if member_id in connected_ids and member_id not in blocked_ids
    ]
