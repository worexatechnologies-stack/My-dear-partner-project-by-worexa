"""Shared message retention, visibility, and conversation helpers."""

import base64
import binascii
import json
from datetime import timedelta

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import (
    ChatConversation,
    ChatConversationParticipant,
    ChatMessage,
    ChatMessageUserVisibility,
)


LEGACY_E2EE_PREFIX = '__E2EE__:'
LEGACY_E2EE_SALT = b'mdp_fallback_e2ee_salt_2026'


def member_display_name(member):
    if not member:
        return ''
    return member.get_full_name() or member.email or str(member.pk)


def _ordered_members(first, second):
    return sorted((first, second), key=lambda member: str(member.pk))


def get_or_create_conversation(first, second):
    """Return the stable two-member conversation and its participant rows."""

    member_one, member_two = _ordered_members(first, second)
    lookup = {
        'member_one_id_snapshot': member_one.pk,
        'member_two_id_snapshot': member_two.pk,
    }
    try:
        with transaction.atomic():
            conversation, _ = ChatConversation.objects.select_for_update().get_or_create(
                **lookup,
                defaults={
                    'member_one': member_one,
                    'member_two': member_two,
                    'member_one_name_snapshot': member_display_name(member_one),
                    'member_two_name_snapshot': member_display_name(member_two),
                },
            )
            ChatConversationParticipant.objects.get_or_create(
                conversation=conversation,
                member_id_snapshot=member_one.pk,
                defaults={'member': member_one, 'display_name_snapshot': member_display_name(member_one)},
            )
            ChatConversationParticipant.objects.get_or_create(
                conversation=conversation,
                member_id_snapshot=member_two.pk,
                defaults={'member': member_two, 'display_name_snapshot': member_display_name(member_two)},
            )
            return conversation
    except IntegrityError:
        # A concurrent first message may win the unique pair insert.
        conversation = ChatConversation.objects.get(**lookup)
        ChatConversationParticipant.objects.get_or_create(
            conversation=conversation,
            member_id_snapshot=member_one.pk,
            defaults={'member': member_one, 'display_name_snapshot': member_display_name(member_one)},
        )
        ChatConversationParticipant.objects.get_or_create(
            conversation=conversation,
            member_id_snapshot=member_two.pk,
            defaults={'member': member_two, 'display_name_snapshot': member_display_name(member_two)},
        )
        return conversation


def create_message(*, sender, receiver, text, message_type=ChatMessage.MessageType.TEXT, metadata=None):
    conversation = get_or_create_conversation(sender, receiver)
    message = ChatMessage.objects.create(
        conversation=conversation,
        sender=sender,
        receiver=receiver,
        text=text,
        message_type=message_type,
        metadata=metadata or {},
        retention_expires_at=timezone.now() + timedelta(days=settings.MESSAGE_RETENTION_DAYS),
        sender_id_snapshot=sender.pk,
        receiver_id_snapshot=receiver.pk,
        sender_name_snapshot=member_display_name(sender),
        receiver_name_snapshot=member_display_name(receiver),
    )
    ChatConversation.objects.filter(pk=conversation.pk).update(
        last_message_at=message.created_at,
        updated_at=message.created_at,
    )
    return message


def visible_messages_for_user(conversation, member):
    return (
        ChatMessage.objects.filter(conversation=conversation)
        .exclude(user_visibility__user_id_snapshot=member.pk, user_visibility__hidden=True)
        .order_by('created_at')
    )


def message_is_visible_to_user(message, member):
    return not ChatMessageUserVisibility.objects.filter(
        message=message,
        user_id_snapshot=member.pk,
        hidden=True,
    ).exists()


def hide_message_for_user(message, member):
    ChatMessageUserVisibility.objects.update_or_create(
        message=message,
        user_id_snapshot=member.pk,
        defaults={'user': member, 'hidden': True, 'hidden_at': timezone.now()},
    )


def _legacy_e2ee_seeds(message):
    """Return the deterministic legacy encryption seeds without exposing them."""

    sender_id = message.sender_id or message.sender_id_snapshot
    receiver_id = message.receiver_id or message.receiver_id_snapshot
    seeds = []
    if sender_id and receiver_id:
        seeds.append('_'.join(sorted((str(sender_id), str(receiver_id)))))
    if message.conversation_id:
        seeds.append(str(message.conversation_id))
    if sender_id:
        seeds.append(str(sender_id))
    if receiver_id:
        seeds.append(str(receiver_id))
    seeds.append('default')
    return tuple(dict.fromkeys(seeds))


def decrypt_retained_message_text(message):
    """Decode legacy fallback-encrypted chat text for the privileged audit flow.

    This is intentionally server-side only. Normal member message APIs keep
    returning the stored payload, which is decrypted in the participant's
    browser. A malformed or unavailable legacy payload never leaks raw cipher
    text into the audit interface.
    """

    text = str(message.text or '')
    if not text.startswith(LEGACY_E2EE_PREFIX):
        return text

    try:
        payload = json.loads(text[len(LEGACY_E2EE_PREFIX):])
        iv = base64.b64decode(payload['iv'], validate=True)
        ciphertext = base64.b64decode(payload['ct'], validate=True)
    except (binascii.Error, json.JSONDecodeError, KeyError, TypeError, ValueError):
        return 'Encrypted message unavailable'

    for seed in _legacy_e2ee_seeds(message):
        try:
            key = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=LEGACY_E2EE_SALT,
                iterations=1000,
            ).derive(seed.encode('utf-8'))
            return AESGCM(key).decrypt(iv, ciphertext, None).decode('utf-8')
        except (InvalidTag, UnicodeDecodeError, ValueError):
            continue

    return 'Encrypted message unavailable'


def serialize_message(message, *, viewer=None, privileged=False):
    deleted = bool(message.deleted_for_everyone)
    hidden_for_viewer = bool(
        viewer and ChatMessageUserVisibility.objects.filter(
            message=message,
            user_id_snapshot=viewer.pk,
            hidden=True,
        ).exists()
    )
    if hidden_for_viewer and not privileged:
        return None

    return {
        'id': str(message.pk),
        'conversation_id': str(message.conversation_id) if message.conversation_id else None,
        'sender_id': str(message.sender_id or message.sender_id_snapshot or ''),
        'receiver_id': str(message.receiver_id or message.receiver_id_snapshot or ''),
        'text': decrypt_retained_message_text(message) if privileged else (message.text if not deleted else 'Message deleted'),
        'message_type': message.message_type,
        'metadata': message.metadata or {},
        'is_read': message.is_read,
        'created_at': message.created_at,
        'updated_at': message.updated_at,
        'status': 'DELETED_FOR_EVERYONE' if deleted else 'ACTIVE',
        'deleted_for_everyone': deleted,
        'deletion_type': message.deletion_type or None,
        'deleted_at': message.deleted_at,
        'deleted_by_id': str(message.deleted_by_id or '') if message.deleted_by_id else None,
        'sender_name': message.sender_name_snapshot,
        'receiver_name': message.receiver_name_snapshot,
    }


def conversation_contains_member(conversation, member):
    return conversation.participants.filter(
        member_id_snapshot=member.pk,
        left_at__isnull=True,
    ).exists()
