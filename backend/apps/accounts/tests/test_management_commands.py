import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.accounts.models import Admin, Member, MemberProfile, Staff, SuperAdmin
from apps.core.models import Notification


pytestmark = pytest.mark.django_db


def test_account_creation_commands_hash_passwords():
    password = 'CommandPassword!971'
    common = {
        'mobile_number': '9876543250',
        'first_name': 'Command',
        'last_name': 'Created',
        'password': password,
    }
    call_command('create_super_admin', email='owner-command@example.com', **common)
    owner = SuperAdmin.objects.get(email='owner-command@example.com')
    assert owner.check_password(password)
    assert owner.password != password


def test_baseline_contains_no_sample_accounts(db):
    assert not Member.objects.exists()
    assert not SuperAdmin.objects.exists()
    assert not Admin.objects.exists()
    assert not Staff.objects.exists()


@override_settings(DEBUG=False, ALLOW_DESTRUCTIVE_DEV_RESET=True)
def test_rebuild_refuses_when_debug_is_false():
    with pytest.raises(CommandError, match='DEBUG=False'):
        call_command('rebuild_development_database', confirm=':memory:')


@override_settings(DEBUG=True, ALLOW_DESTRUCTIVE_DEV_RESET=False)
def test_rebuild_requires_explicit_destructive_flag():
    with pytest.raises(CommandError, match='ALLOW_DESTRUCTIVE_DEV_RESET'):
        call_command('rebuild_development_database', confirm=':memory:')


def test_reset_database_keep_users_is_dry_run_by_default(capsys):
    members = [
        Member.objects.create_user(
            email=f'keep-{index}@example.com',
            password='TestPassword!123',
            first_name='Keep',
        )
        for index in range(4)
    ]
    Notification.objects.create(
        member_recipient=members[0],
        notification_type='TEST',
        title='Test',
        message='Dry run must not delete this.',
    )

    call_command('reset_database_keep_users', *(member.email for member in members))

    assert Member.objects.count() == 4
    assert Notification.objects.count() == 1
    assert 'Dry run complete' in capsys.readouterr().out


def test_reset_database_keep_users_preserves_only_accounts_and_member_profiles():
    members = [
        Member.objects.create_user(
            email=f'retain-{index}@example.com',
            password='TestPassword!123',
            first_name='Retain',
        )
        for index in range(4)
    ]
    MemberProfile.objects.create(member=members[0], about='Retained profile')
    removed = Member.objects.create_user(
        email='remove@example.com', password='TestPassword!123', first_name='Remove'
    )
    MemberProfile.objects.create(member=removed, about='Removed profile')
    Notification.objects.create(
        member_recipient=members[0], notification_type='TEST', title='Test', message='Delete me.'
    )

    call_command(
        'reset_database_keep_users', *(member.email for member in members), execute=True
    )

    assert set(Member.objects.values_list('email', flat=True)) == {member.email for member in members}
    assert MemberProfile.objects.count() == 1
    assert MemberProfile.objects.get().member_id == members[0].pk
    assert Notification.objects.count() == 0
