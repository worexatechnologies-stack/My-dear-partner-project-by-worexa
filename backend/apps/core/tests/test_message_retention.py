import base64
import json
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from apps.core.message_service import create_message
from apps.core.models import AdminMessageAccessLog, ChatMessage
from apps.accounts.services import permanently_delete_member


pytestmark = pytest.mark.django_db


def _legacy_encrypt(text, sender, receiver):
    seed = '_'.join(sorted((str(sender.pk), str(receiver.pk))))
    key = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'mdp_fallback_e2ee_salt_2026',
        iterations=1000,
    ).derive(seed.encode('utf-8'))
    iv = b'0123456789ab'
    ciphertext = AESGCM(key).encrypt(iv, text.encode('utf-8'), None)
    return '__E2EE__:' + json.dumps({
        'iv': base64.b64encode(iv).decode('ascii'),
        'ct': base64.b64encode(ciphertext).decode('ascii'),
    })


def _approve(*members):
    for member in members:
        member.profile_status = member.ProfileStatus.APPROVED
        member.save(update_fields=('profile_status',))


def test_delete_for_me_hides_only_for_the_requesting_member(authenticated_client, member, other_member):
    _approve(member, other_member)
    message = create_message(sender=member, receiver=other_member, text='Private retained text')

    deleted = authenticated_client(member).post(
        f'/api/v1/messages/{message.pk}/delete/',
        {'action': 'for_me'},
        format='json',
    )
    assert deleted.status_code == 200, deleted.data

    member_history = authenticated_client(member).get(f'/api/v1/conversations/{other_member.pk}/messages/')
    other_history = authenticated_client(other_member).get(f'/api/v1/conversations/{member.pk}/messages/')
    assert member_history.status_code == 200
    assert other_history.status_code == 200
    assert member_history.data['data']['messages'] == []
    assert other_history.data['data']['messages'][0]['text'] == 'Private retained text'
    assert ChatMessage.objects.filter(pk=message.pk, text='Private retained text').exists()


def test_delete_for_everyone_returns_tombstone_but_retains_original(authenticated_client, member, other_member):
    _approve(member, other_member)
    message = create_message(sender=member, receiver=other_member, text='Original moderation text')

    deleted = authenticated_client(member).post(
        f'/api/v1/messages/{message.pk}/delete/',
        {'action': 'for_everyone'},
        format='json',
    )
    assert deleted.status_code == 200, deleted.data

    member_history = authenticated_client(member).get(f'/api/v1/conversations/{other_member.pk}/messages/')
    other_history = authenticated_client(other_member).get(f'/api/v1/conversations/{member.pk}/messages/')
    assert member_history.data['data']['messages'][0]['text'] == 'Message deleted'
    assert other_history.data['data']['messages'][0]['text'] == 'Message deleted'
    message.refresh_from_db()
    assert message.text == 'Original moderation text'
    assert message.deleted_for_everyone is True


def test_message_audit_requires_reason_and_is_super_admin_only(
    authenticated_client,
    admin_account,
    member,
    other_member,
    super_admin,
):
    _approve(member, other_member)
    message = create_message(sender=member, receiver=other_member, text='Audit-only original')
    authenticated_client(member).post(
        f'/api/v1/messages/{message.pk}/delete/',
        {'action': 'for_everyone'},
        format='json',
    )

    forbidden = authenticated_client(admin_account).get('/api/v1/admin/message-audit/conversations/')
    assert forbidden.status_code == 403

    missing_reason = authenticated_client(super_admin).get('/api/v1/admin/message-audit/conversations/')
    assert missing_reason.status_code == 400

    conversations = authenticated_client(super_admin).get(
        '/api/v1/admin/message-audit/conversations/',
        {'reason': 'User reported harassment'},
    )
    assert conversations.status_code == 200, conversations.data
    conversation_id = conversations.data['data']['results'][0]['id']

    history = authenticated_client(super_admin).get(
        f'/api/v1/admin/message-audit/conversations/{conversation_id}/messages/',
        {'reason': 'User reported harassment'},
    )
    assert history.status_code == 200, history.data
    assert history.data['data']['results'][0]['text'] == 'Audit-only original'
    assert AdminMessageAccessLog.objects.filter(
        admin_user=super_admin,
        action=AdminMessageAccessLog.Action.VIEW_DELETED_MESSAGE,
        message=message,
        reason='User reported harassment',
    ).exists()


def test_super_admin_audit_decrypts_legacy_chat_payloads(
    authenticated_client,
    member,
    other_member,
    super_admin,
):
    _approve(member, other_member)
    plaintext = 'Retained encrypted audit text'
    encrypted = _legacy_encrypt(plaintext, member, other_member)
    message = create_message(sender=member, receiver=other_member, text=encrypted)

    history = authenticated_client(super_admin).get(
        f'/api/v1/admin/message-audit/conversations/{message.conversation_id}/messages/',
        {'reason': 'Reported safety investigation'},
    )

    assert history.status_code == 200, history.data
    assert history.data['data']['results'][0]['text'] == plaintext
    message.refresh_from_db()
    assert message.text == encrypted


def test_member_history_uses_cursor_pages_of_twenty(authenticated_client, member, other_member):
    _approve(member, other_member)
    for index in range(25):
        create_message(sender=member, receiver=other_member, text=f'History message {index}')

    first = authenticated_client(member).get(
        f'/api/v1/conversations/{other_member.pk}/messages/',
        {'page_size': 20},
    )

    assert first.status_code == 200, first.data
    first_page = first.data['data']
    assert len(first_page['messages']) == 20
    assert first_page['next']

    cursor = parse_qs(urlparse(first_page['next']).query)['cursor'][0]
    second = authenticated_client(member).get(
        f'/api/v1/conversations/{other_member.pk}/messages/',
        {'page_size': 20, 'cursor': cursor},
    )

    assert second.status_code == 200, second.data
    second_page = second.data['data']
    assert len(second_page['messages']) == 5
    assert second_page['next'] is None
    assert len({message['id'] for message in first_page['messages'] + second_page['messages']}) == 25


def test_opening_history_keeps_messages_unread_until_the_member_views_them(
    authenticated_client,
    member,
    other_member,
):
    _approve(member, other_member)
    message = create_message(sender=member, receiver=other_member, text='Please confirm you saw this.')

    history = authenticated_client(other_member).get(
        f'/api/v1/conversations/{member.pk}/messages/',
    )

    assert history.status_code == 200, history.data
    assert history.data['data']['messages'][0]['is_read'] is False
    message.refresh_from_db()
    assert message.is_read is False


def test_mark_read_endpoint_persists_read_status_and_broadcasts_receipt(authenticated_client, member, other_member):
    _approve(member, other_member)
    message = create_message(sender=member, receiver=other_member, text='Mark this message as read.')

    with patch('apps.core.old_views._broadcast_chat_read_receipt') as broadcast_receipt:
        response = authenticated_client(other_member).post(
            f'/api/v1/conversations/{member.pk}/mark-read/',
        )

    assert response.status_code == 200, response.data
    assert response.data['data']['marked_count'] == 1
    message.refresh_from_db()
    assert message.is_read is True
    broadcast_receipt.assert_called_once_with(
        reader=other_member,
        partner=member,
        message_ids=[str(message.pk)],
    )


def test_super_admin_audit_loads_message_history_in_pages(
    authenticated_client,
    member,
    other_member,
    super_admin,
):
    _approve(member, other_member)
    for index in range(25):
        create_message(sender=member, receiver=other_member, text=f'Audit message {index}')
    conversation_id = ChatMessage.objects.first().conversation_id

    first = authenticated_client(super_admin).get(
        f'/api/v1/admin/message-audit/conversations/{conversation_id}/messages/',
        {'reason': 'Reported safety investigation', 'page_size': 20},
    )

    assert first.status_code == 200, first.data
    first_page = first.data['data']
    assert len(first_page['results']) == 20
    assert first_page['has_next'] is True
    assert first_page['total'] == 25

    second = authenticated_client(super_admin).get(
        f'/api/v1/admin/message-audit/conversations/{conversation_id}/messages/',
        {'reason': 'Reported safety investigation', 'page_size': 20, 'page': 2},
    )

    assert second.status_code == 200, second.data
    second_page = second.data['data']
    assert len(second_page['results']) == 5
    assert second_page['has_next'] is False


def test_permanent_member_cleanup_does_not_cascade_delete_retained_message(member, other_member):
    _approve(member, other_member)
    message = create_message(sender=member, receiver=other_member, text='Retained after account cleanup')
    conversation_id = message.conversation_id
    sender_id = member.pk

    permanently_delete_member(member=member)

    message.refresh_from_db()
    assert message.text == 'Retained after account cleanup'
    assert message.sender_id is None
    assert message.sender_id_snapshot == sender_id
    assert message.conversation_id == conversation_id
