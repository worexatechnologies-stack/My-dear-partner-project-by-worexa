from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.lifecycle import request_member_deletion, restore_member_account
from apps.accounts.models import AuthSession, Member
from apps.core.tasks import permanently_delete_expired_members


pytestmark = pytest.mark.django_db


def test_member_deletion_hides_account_and_allows_password_confirmed_recovery(api_client, authenticated_client, member):
    client = authenticated_client(member)
    response = client.delete('/api/v1/member-auth/account/delete/')

    assert response.status_code == 200, response.data
    member.refresh_from_db()
    assert member.account_status == Member.AccountStatus.DELETION_PENDING
    assert member.is_active is False
    assert member.recovery_until is not None
    assert not AuthSession.objects.filter(account_id=member.pk, revoked_at__isnull=True).exists()

    rejected_login = api_client.post(
        '/api/v1/member-auth/login/',
        {'identifier': member.email, 'password': 'WrongPassword!742'},
        format='json',
    )
    assert rejected_login.status_code == 401
    assert 'recovery_ticket' not in (rejected_login.data.get('data') or {})

    login = api_client.post(
        '/api/v1/member-auth/login/',
        {'identifier': member.email, 'password': 'TestPassword!742'},
        format='json',
    )
    assert login.status_code == 403
    assert login.data['data']['code'] == 'ACCOUNT_DELETION_PENDING'
    recovery_ticket = login.data['data']['recovery_ticket']

    verified = api_client.post(
        '/api/v1/member-auth/account/recovery/verify/',
        {'recovery_ticket': recovery_ticket},
        format='json',
    )
    assert verified.status_code == 200, verified.data
    member.refresh_from_db()
    assert member.account_status == Member.AccountStatus.ACTIVE
    assert member.is_active is True
    assert member.deleted_at is None
    assert member.recovery_until is None


def test_admin_deletion_can_only_be_restored_inside_window(member, admin_account):
    pending = request_member_deletion(member=member, actor=admin_account, reason='Policy review')
    assert pending.deleted_by == 'ADMIN'
    assert pending.deleted_by_user_id == admin_account.pk
    assert pending.deletion_reason == 'Policy review'

    member.recovery_until = timezone.now() - timedelta(seconds=1)
    member.save(update_fields=('recovery_until', 'updated_at'))

    with pytest.raises(ValueError, match='permanently deleted'):
        restore_member_account(member=member)


def test_expired_deletion_task_removes_member(member):
    request_member_deletion(member=member)
    member.recovery_until = timezone.now() - timedelta(seconds=1)
    member.save(update_fields=('recovery_until', 'updated_at'))

    assert permanently_delete_expired_members() == 1
    assert not Member.objects.filter(pk=member.pk).exists()


def test_block_endpoint_lists_and_removes_block(authenticated_client, member, other_member):
    client = authenticated_client(member)
    blocked = client.post('/blocks/', {'member_id': str(other_member.pk)}, format='json')
    assert blocked.status_code == 201, blocked.data

    listed = client.get('/blocks/')
    assert listed.status_code == 200
    assert listed.data['data'][0]['id'] == str(other_member.pk)

    unblocked = client.delete(f'/blocks/{other_member.pk}/')
    assert unblocked.status_code == 200
    assert client.get('/blocks/').data['data'] == []
