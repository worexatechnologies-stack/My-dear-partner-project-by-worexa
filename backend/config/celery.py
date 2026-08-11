import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    f"config.settings.{os.environ.get('DJANGO_ENV', 'local')}",
)

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'reset-daily-view-limits': {
        'task': 'apps.memberships.tasks.reset_daily_view_limits',
        'schedule': crontab(hour=0, minute=0),
    },
    'recalculate-compatibility-scores': {
        'task': 'apps.matching.tasks.recalculate_compatibility_scores',
        'schedule': crontab(hour=0, minute=15),
    },
    'retry-stored-file-deletions': {
        'task': 'apps.common.tasks.retry_stored_file_deletions',
        'schedule': 300.0,
        'kwargs': {'limit': 100},
    },
    'expire-memberships': {
        'task': 'apps.memberships.tasks.expire_memberships',
        'schedule': crontab(hour=0, minute=5),
    },
    'notify-expiring-memberships': {
        'task': 'apps.memberships.tasks.notify_expiring_memberships',
        'schedule': crontab(hour=9, minute=0),
    },
}


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
