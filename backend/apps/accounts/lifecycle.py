"""Member account lifecycle transitions and deletion recovery rules."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import AccountType, AuthSession, Member


RECOVERY_WINDOW = timedelta(days=30)


def _actor_label(actor):
    if actor is None:
        return 'USER'
    return str(getattr(actor, 'account_type', AccountType.MEMBER))


@transaction.atomic
def request_member_deletion(*, member, actor=None, reason=''):
    """Move an active member into the reversible 30-day deletion state."""

    locked = Member.objects.select_for_update().get(pk=member.pk)
    now = timezone.now()
    if locked.account_status == Member.AccountStatus.DELETION_PENDING:
        if locked.recovery_until and locked.recovery_until > now:
            return locked
        raise ValueError('This account is past its recovery deadline.')

    locked.account_status = Member.AccountStatus.DELETION_PENDING
    locked.is_active = False
    locked.deleted_at = now
    locked.recovery_until = now + RECOVERY_WINDOW
    locked.deleted_by = _actor_label(actor)
    locked.deleted_by_user_id = getattr(actor, 'pk', None)
    locked.deletion_reason = str(reason or '')[:5000]
    locked.token_version += 1
    locked.save(update_fields=(
        'account_status', 'is_active', 'deleted_at', 'recovery_until',
        'deleted_by', 'deleted_by_user_id', 'deletion_reason', 'token_version', 'updated_at',
    ))
    AuthSession.objects.filter(
        account_id=locked.pk,
        account_type=str(AccountType.MEMBER),
        revoked_at__isnull=True,
    ).update(
        revoked_at=now,
        revocation_reason='ACCOUNT_DELETION_PENDING',
        updated_at=now,
    )
    return locked


@transaction.atomic
def restore_member_account(*, member):
    """Restore only an account still inside its 30-day recovery window."""

    locked = Member.objects.select_for_update().get(pk=member.pk)
    now = timezone.now()
    if locked.account_status != Member.AccountStatus.DELETION_PENDING:
        if locked.account_status == Member.AccountStatus.SUSPENDED:
            raise ValueError('Suspended accounts require an administrative unsuspend action.')
        return locked
    if not locked.recovery_until or locked.recovery_until <= now:
        raise ValueError('This account has been permanently deleted and can no longer be recovered.')

    locked.account_status = Member.AccountStatus.ACTIVE
    locked.is_active = True
    locked.deleted_at = None
    locked.recovery_until = None
    locked.deleted_by = ''
    locked.deleted_by_user_id = None
    locked.deletion_reason = ''
    locked.token_version += 1
    locked.save(update_fields=(
        'account_status', 'is_active', 'deleted_at', 'recovery_until',
        'deleted_by', 'deleted_by_user_id', 'deletion_reason', 'token_version', 'updated_at',
    ))
    return locked


def deletion_days_remaining(member):
    if not member.recovery_until:
        return 0
    remaining = member.recovery_until - timezone.now()
    return max(0, remaining.days + (1 if remaining.seconds else 0))
