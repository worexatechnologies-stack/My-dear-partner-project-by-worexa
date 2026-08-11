from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.accounts.models import Admin, SuperAdmin

from .api_utils import notify
from .models import Notification, SupportTicket


def _already_notified(recipient_field, recipient, ticket):
    return Notification.objects.filter(
        **{recipient_field: recipient},
        notification_type='TICKET_SLA_OVERDUE',
        related_object_id=str(ticket.pk),
    ).exists()


@shared_task(name='apps.core.tasks.process_sla_escalations')
def process_sla_escalations():
    """Notify only the people responsible for unresolved overdue tickets."""

    now = timezone.now()
    unresolved = SupportTicket.objects.exclude(
        status__in=(SupportTicket.Status.RESOLVED, SupportTicket.Status.CLOSED)
    ).select_related('category')
    overdue_count = 0
    for ticket in unresolved:
        sla = ticket.category.sla_rules.filter(
            priority=ticket.priority,
            is_active=True,
        ).first()
        if not sla or ticket.created_at + timedelta(minutes=sla.resolution_minutes) >= now:
            continue
        overdue_count += 1
        managers = Admin.objects.filter(
            is_active=True,
            deleted_at__isnull=True,
            role__role_permissions__permission__code='tickets.assign',
            role__role_permissions__is_allowed=True,
        ).distinct()
        for manager in managers:
            if not _already_notified('admin_recipient', manager, ticket):
                notify(
                    manager,
                    notification_type='TICKET_SLA_OVERDUE',
                    title=f'SLA overdue: {ticket.ticket_number}',
                    message=ticket.subject,
                    related_object=ticket,
                    priority='HIGH',
                )
        if ticket.priority == SupportTicket.Priority.URGENT:
            for owner in SuperAdmin.objects.filter(is_active=True, deleted_at__isnull=True):
                if not _already_notified('super_admin_recipient', owner, ticket):
                    notify(
                        owner,
                        notification_type='TICKET_SLA_OVERDUE',
                        title=f'URGENT SLA breach: {ticket.ticket_number}',
                        message=ticket.subject,
                        related_object=ticket,
                        priority='URGENT',
                    )
    return overdue_count


@shared_task(name='apps.core.tasks.process_webhook_event_task', bind=True, max_retries=3, default_retry_delay=10)
def process_webhook_event_task(self, event_id):
    """Processes Razorpay Webhook Event with Celery retry mechanism."""
    from apps.core.models import RazorpayWebhookEvent
    from apps.core.services.razorpay_memberships import RazorpayMembershipService
    try:
        evt = RazorpayWebhookEvent.objects.get(pk=event_id)
        RazorpayMembershipService.process_webhook_event(evt)
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(name='apps.core.tasks.reconcile_razorpay_payments_task')
def reconcile_razorpay_payments_task(minutes=60):
    """Reconciles payment records with Razorpay gateway periodically."""
    from django.core.management import call_command
    call_command('reconcile_razorpay_payments', minutes=minutes)
