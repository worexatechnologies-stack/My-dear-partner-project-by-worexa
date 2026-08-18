from datetime import timedelta

from django.db import migrations, models
from django.utils import timezone


def migrate_legacy_deleted_members(apps, schema_editor):
    Member = apps.get_model('accounts', 'Member')
    now = timezone.now()
    for member in Member.objects.filter(account_status='DELETED'):
        deleted_at = member.deleted_at or now
        member.account_status = 'DELETION_PENDING'
        member.recovery_until = deleted_at + timedelta(days=30)
        member.deleted_by = member.deleted_by or 'ADMIN'
        member.save(update_fields=('account_status', 'recovery_until', 'deleted_by'))


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0042_member_login_lockout_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='member',
            name='recovery_until',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='member',
            name='deleted_by',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='member',
            name='deleted_by_user_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='member',
            name='deletion_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.RunPython(migrate_legacy_deleted_members, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='member',
            name='account_status',
            field=models.CharField(
                choices=[
                    ('ACTIVE', 'Active'),
                    ('SUSPENDED', 'Suspended'),
                    ('DELETION_PENDING', 'Deletion pending'),
                    ('ARCHIVED', 'Archived'),
                    ('DELETED', 'Deleted'),
                ],
                db_index=True,
                default='ACTIVE',
                max_length=20,
            ),
        ),
    ]
