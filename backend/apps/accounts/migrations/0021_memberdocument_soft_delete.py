from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0020_member_document_db_storage'),
    ]

    operations = [
        migrations.AddField(
            model_name='memberdocument',
            name='changes_requested_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='deleted_by_id',
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='deletion_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
    ]
