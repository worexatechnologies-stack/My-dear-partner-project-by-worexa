import gzip
from datetime import timedelta
from uuid import UUID

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction, DatabaseError
from django.db.models import F, Q
from django.utils import timezone

from apps.accounts.models import Admin, SuperAdmin
from .api_utils import audit, create_notification, client_ip
from .models import (
    AdminTicketReadState,
    Notification,
    SupportCategory,
    SupportSlaRule,
    SupportTicket,
    SupportTicketAttachment,
    SupportTicketReply,
    TicketAssignment,
    TicketAuditLog,
    TicketInternalNote,
    TicketStatusHistory,
)
from .serializers import validate_private_attachment


def validate_support_attachment(file_obj):
    try:
        return validate_private_attachment(file_obj)
    except Exception as exc:
        detail = getattr(exc, 'detail', None)
        raise DjangoValidationError(str(detail or exc)) from exc


def calculate_sla(category, priority):
    rule = SupportSlaRule.objects.filter(
        category=category, priority=priority, is_active=True
    ).first()
    if rule:
        return timezone.now() + timedelta(minutes=rule.resolution_minutes)
    return None


def get_actor_info(request):
    user = request.user
    if hasattr(user, 'is_authenticated') and user.is_authenticated:
        return {
            'actor_id': user.pk,
            'actor_name': user.get_full_name() or user.email or '',
            'actor_role': str(getattr(user, 'account_type', '')),
            'ip_address': client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', '')[:1000],
            'request': request,
        }
    return {
        'actor_id': None,
        'actor_name': 'System',
        'actor_role': 'SYSTEM',
        'ip_address': None,
        'user_agent': '',
        'request': None,
    }


def _write_audit(ticket, action, actor_info, old_value=None, new_value=None, reason=''):
    return TicketAuditLog.objects.create(
        ticket=ticket,
        actor_id=actor_info['actor_id'],
        actor_name=actor_info['actor_name'],
        actor_role=actor_info['actor_role'],
        action=action,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        ip_address=actor_info['ip_address'],
        user_agent=actor_info['user_agent'],
    )


def _write_status_history(ticket, old_status, new_status, actor_info, reason=''):
    return TicketStatusHistory.objects.create(
        ticket=ticket,
        old_status=old_status,
        new_status=new_status,
        reason=reason,
        changed_by_admin=Admin.objects.filter(pk=actor_info['actor_id']).first() if actor_info['actor_role'] == 'ADMIN' else None,
        changed_by_super_admin=SuperAdmin.objects.filter(pk=actor_info['actor_id']).first() if actor_info['actor_role'] == 'SUPER_ADMIN' else None,
        changed_by_member=None,
    )


def _notify_assignees(ticket, notification_type, title, message, priority='NORMAL'):
    recipients = []
    admins = Admin.objects.filter(is_active=True, deleted_at__isnull=True)
    super_admins = SuperAdmin.objects.filter(is_active=True, deleted_at__isnull=True)
    for a in admins:
        if a not in recipients:
            recipients.append(a)
    for sa in super_admins:
        if sa not in recipients:
            recipients.append(sa)
    for recipient in recipients:
        try:
            create_notification(
                recipient,
                type=notification_type,
                title=title,
                body=message,
                related_object=ticket,
                priority=priority,
            )
        except Exception:
            pass


@transaction.atomic
def claim_ticket(ticket_id, actor, request=None):
    """Atomically claim a ticket with row-level locking."""
    ticket = SupportTicket.objects.select_for_update(
        skip_locked=True
    ).filter(
        pk=ticket_id,
        status__in=[SupportTicket.Status.UNASSIGNED, SupportTicket.Status.OPEN, SupportTicket.Status.REOPENED],
        claimed_by_admin__isnull=True,
        claimed_by_super_admin__isnull=True,
    ).first()

    if not ticket:
        existing = SupportTicket.objects.filter(pk=ticket_id).first()
        if not existing:
            raise DjangoValidationError('Ticket not found.')
        if existing.claimed_by_admin or existing.claimed_by_super_admin:
            raise DjangoValidationError('This ticket is already assigned to another admin.')
        raise DjangoValidationError(f'Ticket cannot be claimed in its current status: {existing.status}')

    actor_type = str(actor.account_type)
    actor_info = get_actor_info(request) if request else {
        'actor_id': actor.pk, 'actor_name': actor.get_full_name() or '',
        'actor_role': actor_type, 'ip_address': None, 'user_agent': '',
        'request': None,
    }

    old_status = ticket.status
    ticket.status = SupportTicket.Status.IN_PROGRESS
    if actor_type == 'SUPER_ADMIN':
        ticket.claimed_by_super_admin = actor
    elif actor_type == 'ADMIN':
        ticket.claimed_by_admin = actor
    ticket.save(update_fields=['status', 'claimed_by_super_admin', 'claimed_by_admin', 'updated_at', 'version'])

    TicketAssignment.objects.create(
        ticket=ticket,
        assigned_by_admin=actor if actor_type == 'ADMIN' else None,
        assigned_by_super_admin=actor if actor_type == 'SUPER_ADMIN' else None,
        is_current=True,
    )

    _write_status_history(ticket, old_status, ticket.status, actor_info, reason='Claimed by admin')
    _write_audit(ticket, TicketAuditLog.Action.TICKET_CLAIMED, actor_info,
                 old_value={'status': old_status}, new_value={'status': ticket.status, 'assignee': str(actor.pk)})

    if request:
        audit(request, actor, action='TICKET_CLAIMED', module='support',
              target_type='SupportTicket', target_id=str(ticket.pk),
              description=f'Ticket {ticket.ticket_number} claimed',
              old_data={'status': old_status}, new_data={'status': ticket.status})

    _notify_assignees(ticket, 'TICKET_CLAIMED', f'Ticket {ticket.ticket_number} claimed',
                      f'{actor.get_full_name() or actor.email} claimed ticket {ticket.ticket_number}')

    return ticket


@transaction.atomic
def reply_to_ticket(ticket, message, actor, attachment=None, request=None, is_public=True):
    actor_type = str(actor.account_type)
    actor_info = get_actor_info(request) if request else {
        'actor_id': actor.pk, 'actor_name': actor.get_full_name() or '',
        'actor_role': actor_type, 'ip_address': None, 'user_agent': '',
        'request': None,
    }

    reply = SupportTicketReply.objects.create(
        ticket=ticket,
        message=message,
        is_public=is_public,
        member_sender=actor if actor_type == 'MEMBER' else None,
        admin_sender=actor if actor_type == 'ADMIN' else None,
        super_admin_sender=actor if actor_type == 'SUPER_ADMIN' else None,
    )

    if not ticket.first_response_at and actor_type != 'MEMBER':
        ticket.first_response_at = timezone.now()
        ticket.save(update_fields=['first_response_at', 'last_reply_at', 'updated_at'])

    ticket.last_reply_at = timezone.now()
    if not ticket.claimed_by_admin and not ticket.claimed_by_super_admin and actor_type in ('ADMIN', 'SUPER_ADMIN'):
        if actor_type == 'SUPER_ADMIN':
            ticket.claimed_by_super_admin = actor
        elif actor_type == 'ADMIN':
            ticket.claimed_by_admin = actor

    if is_public and actor_type == 'MEMBER' and ticket.status not in (SupportTicket.Status.CLOSED, SupportTicket.Status.RESOLVED):
        ticket.status = SupportTicket.Status.IN_PROGRESS
    ticket.save(update_fields=['last_reply_at', 'status', 'claimed_by_super_admin', 'claimed_by_admin', 'updated_at'])

    if attachment:
        raw_data = attachment.read()
        compressed_data = gzip.compress(raw_data)
        SupportTicketAttachment.objects.create(
            ticket=ticket,
            reply=reply,
            uploaded_by_member=actor if actor_type == 'MEMBER' else None,
            uploaded_by_admin=actor if actor_type == 'ADMIN' else None,
            uploaded_by_super_admin=actor if actor_type == 'SUPER_ADMIN' else None,
            file_bytes=compressed_data,
            compression='gzip',
            original_filename=attachment.name[:255],
            mime_type=(getattr(attachment, 'content_type', '') or 'application/octet-stream')[:100],
            file_size=attachment.size,
        )

    action_type = TicketAuditLog.Action.INTERNAL_NOTE_ADDED if not is_public else TicketAuditLog.Action.REPLY_SENT
    _write_audit(ticket, action_type, actor_info, new_value={'message_preview': message[:200]})

    _notify_assignees(ticket, 'NEW_REPLY' if is_public else 'NEW_NOTE',
                      f'New {"reply" if is_public else "note"} on {ticket.ticket_number}',
                      message[:200])

    AdminTicketReadState.objects.filter(ticket=ticket).exclude(
        admin_id=actor.pk, admin_type=actor_type
    ).update(unread_count=F('unread_count') + 1)

    return reply


@transaction.atomic
def resolve_ticket(ticket, summary, actor, request=None):
    actor_type = str(actor.account_type)
    actor_info = get_actor_info(request) if request else {
        'actor_id': actor.pk, 'actor_name': actor.get_full_name() or '',
        'actor_role': actor_type, 'ip_address': None, 'user_agent': '',
        'request': None,
    }

    if ticket.status in (SupportTicket.Status.RESOLVED, SupportTicket.Status.CLOSED):
        raise DjangoValidationError(f'Ticket is already {ticket.status.lower()}.')

    old_status = ticket.status
    ticket.status = SupportTicket.Status.RESOLVED
    ticket.is_resolved = True
    ticket.resolved_at = timezone.now()
    ticket.resolution_summary = summary
    ticket.resolver_id = actor.pk
    ticket.resolver_name = actor.get_full_name() or getattr(actor, 'first_name', '') or str(actor)
    ticket.resolver_email = getattr(actor, 'email', '') or ''
    ticket.resolver_phone = getattr(actor, 'mobile_number', '') or ''
    ticket.resolver_custom_id = getattr(actor, 'admin_id', '') or ''

    if actor_type == 'SUPER_ADMIN':
        ticket.resolved_by_super_admin = actor
        if not ticket.claimed_by_super_admin and not ticket.claimed_by_admin:
            ticket.claimed_by_super_admin = actor
    elif actor_type == 'ADMIN':
        ticket.resolved_by_admin = actor
        if not ticket.claimed_by_admin and not ticket.claimed_by_super_admin:
            ticket.claimed_by_admin = actor

    ticket.save(update_fields=[
        'status', 'is_resolved', 'resolved_at', 'resolution_summary',
        'resolver_id', 'resolver_name', 'resolver_email', 'resolver_phone', 'resolver_custom_id',
        'resolved_by_super_admin', 'resolved_by_admin',
        'claimed_by_super_admin', 'claimed_by_admin',
        'updated_at',
    ])

    _write_status_history(ticket, old_status, ticket.status, actor_info, reason=summary)
    _write_audit(ticket, TicketAuditLog.Action.TICKET_RESOLVED, actor_info,
                 old_value={'status': old_status}, new_value={'status': ticket.status, 'summary': summary})

    if request:
        audit(request, actor, action='TICKET_RESOLVED', module='support',
              target_type='SupportTicket', target_id=str(ticket.pk),
              description=f'Ticket {ticket.ticket_number} resolved',
              old_data={'status': old_status}, new_data={'status': ticket.status})

    _notify_assignees(ticket, 'TICKET_RESOLVED', f'Ticket {ticket.ticket_number} resolved', summary)

    return ticket


@transaction.atomic
def reopen_ticket(ticket, reason, actor, request=None):
    actor_type = str(actor.account_type)
    actor_info = get_actor_info(request) if request else {
        'actor_id': actor.pk, 'actor_name': actor.get_full_name() or '',
        'actor_role': actor_type, 'ip_address': None, 'user_agent': '',
        'request': None,
    }

    if ticket.status not in (SupportTicket.Status.RESOLVED, SupportTicket.Status.CLOSED):
        raise DjangoValidationError('Only resolved or closed tickets can be reopened.')

    old_status = ticket.status
    ticket.status = SupportTicket.Status.REOPENED
    ticket.reopened_count = F('reopened_count') + 1
    ticket.save(update_fields=['status', 'reopened_count', 'updated_at'])
    ticket.refresh_from_db()

    _write_status_history(ticket, old_status, ticket.status, actor_info, reason=reason)
    _write_audit(ticket, TicketAuditLog.Action.TICKET_REOPENED, actor_info,
                 old_value={'status': old_status}, new_value={'status': ticket.status, 'reason': reason})

    _notify_assignees(ticket, 'TICKET_REOPENED', f'Ticket {ticket.ticket_number} reopened', reason)
    return ticket


@transaction.atomic
def close_ticket(ticket, reason, actor, request=None):
    actor_type = str(actor.account_type)
    actor_info = get_actor_info(request) if request else {
        'actor_id': actor.pk, 'actor_name': actor.get_full_name() or '',
        'actor_role': actor_type, 'ip_address': None, 'user_agent': '',
        'request': None,
    }

    if ticket.status == SupportTicket.Status.CLOSED:
        raise DjangoValidationError('Ticket is already closed.')

    old_status = ticket.status
    ticket.status = SupportTicket.Status.CLOSED
    ticket.closed_at = timezone.now()

    if actor_type == 'SUPER_ADMIN':
        ticket.closed_by_super_admin = actor
    elif actor_type == 'ADMIN':
        ticket.closed_by_admin = actor

    ticket.save(update_fields=[
        'status', 'closed_at',
        'closed_by_super_admin', 'closed_by_admin',
        'updated_at',
    ])

    _write_status_history(ticket, old_status, ticket.status, actor_info, reason=reason)
    _write_audit(ticket, TicketAuditLog.Action.TICKET_CLOSED, actor_info,
                 old_value={'status': old_status}, new_value={'status': ticket.status, 'reason': reason})

    _notify_assignees(ticket, 'TICKET_CLOSED', f'Ticket {ticket.ticket_number} closed', reason)
    return ticket


def update_read_state(admin_id, admin_type, ticket, message_id=None):
    state, created = AdminTicketReadState.objects.get_or_create(
        admin_id=admin_id,
        admin_type=admin_type,
        ticket=ticket,
        defaults={'unread_count': 0},
    )
    if message_id:
        state.last_read_message_id = message_id
    state.unread_count = 0
    state.save(update_fields=['last_read_message_id', 'unread_count', 'last_read_at'])
    return state


def get_queue_counts(request_user=None):
    qs = SupportTicket.objects.all()
    return {
        'all': qs.count(),
        'unassigned': qs.filter(claimed_by_admin__isnull=True, claimed_by_super_admin__isnull=True, status__in=[
            SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED, SupportTicket.Status.REOPENED
        ]).count(),
        'open': qs.filter(status__in=[
            SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED, SupportTicket.Status.REOPENED,
            SupportTicket.Status.IN_PROGRESS,
        ]).count(),
        'in_progress': qs.filter(status=SupportTicket.Status.IN_PROGRESS).count(),
        'waiting_for_member': qs.filter(status=SupportTicket.Status.WAITING_FOR_MEMBER).count(),
        'waiting_for_internal': qs.filter(status=SupportTicket.Status.WAITING_FOR_INTERNAL).count(),
        'resolved': qs.filter(status=SupportTicket.Status.RESOLVED).count(),
        'closed': qs.filter(status=SupportTicket.Status.CLOSED).count(),
        'reopened': qs.filter(status=SupportTicket.Status.REOPENED).count(),
        'urgent': qs.filter(priority=SupportTicket.Priority.URGENT).count(),
        'overdue': qs.filter(
            sla_deadline__isnull=False, sla_deadline__lt=timezone.now(),
            status__in=[SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED,
                        SupportTicket.Status.IN_PROGRESS, SupportTicket.Status.REOPENED],
        ).count(),
    }


def get_ticket_filters(request_user=None):
    status_map = {
        'all': {},
        'unassigned': {'claimed_by_admin__isnull': True, 'claimed_by_super_admin__isnull': True, 'status__in': [
            SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED, SupportTicket.Status.REOPENED
        ]},
        'open': {'status__in': [SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED,
                                SupportTicket.Status.REOPENED, SupportTicket.Status.IN_PROGRESS]},
        'in_progress': {'status': SupportTicket.Status.IN_PROGRESS},
        'waiting_for_member': {'status': SupportTicket.Status.WAITING_FOR_MEMBER},
        'waiting_for_internal': {'status': SupportTicket.Status.WAITING_FOR_INTERNAL},
        'resolved': {'status': SupportTicket.Status.RESOLVED},
        'closed': {'status': SupportTicket.Status.CLOSED},
        'reopened': {'status': SupportTicket.Status.REOPENED},
        'urgent': {'priority': SupportTicket.Priority.URGENT},
        'overdue': {'sla_deadline__isnull': False, 'sla_deadline__lt': timezone.now(),
                    'status__in': [SupportTicket.Status.OPEN, SupportTicket.Status.UNASSIGNED,
                                   SupportTicket.Status.IN_PROGRESS, SupportTicket.Status.REOPENED]},
        'assigned_to_me': Q(claimed_by_admin=request_user) | Q(claimed_by_super_admin=request_user) if request_user else Q(),
    }
    return status_map
