from django.db import migrations


def register_periodic_tasks(apps, schema_editor):
    try:
        from django_celery_beat.models import PeriodicTask, CrontabSchedule
    except ImportError:
        return

    # 1. Crontab: every 15 minutes
    every_15_min, _ = CrontabSchedule.objects.get_or_create(
        minute='*/15',
        hour='*',
        day_of_week='*',
        day_of_month='*',
        month_of_year='*',
        timezone='Asia/Kolkata',
    )

    # 2. Reconcile Razorpay Payments
    PeriodicTask.objects.update_or_create(
        name='reconcile-razorpay-payments',
        defaults={
            'task': 'apps.core.tasks.reconcile_razorpay_payments_task',
            'crontab': every_15_min,
            'interval': None,
            'enabled': True,
            'description': 'Periodic reconciliation of pending payment orders with Razorpay gateway.',
        },
    )

    # 3. Process SLA Escalations
    PeriodicTask.objects.update_or_create(
        name='process-sla-escalations',
        defaults={
            'task': 'apps.core.tasks.process_sla_escalations',
            'crontab': every_15_min,
            'interval': None,
            'enabled': True,
            'description': 'Periodic check and escalation notifications for overdue support tickets.',
        },
    )


def unregister_periodic_tasks(apps, schema_editor):
    try:
        from django_celery_beat.models import PeriodicTask
    except ImportError:
        return

    PeriodicTask.objects.filter(name__in=['reconcile-razorpay-payments', 'process-sla-escalations']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0054_chat_messages_plaintext'),
        ('django_celery_beat', '0019_alter_periodictasks_options'),
    ]

    operations = [
        migrations.RunPython(register_periodic_tasks, unregister_periodic_tasks),
    ]
