import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='StoredFileDeletionTask',
            fields=[
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ('storage_alias', models.CharField(max_length=64)),
                ('storage_key', models.CharField(max_length=1024)),
                ('attempt_count', models.PositiveIntegerField(default=0)),
                ('last_error', models.TextField(blank=True)),
                (
                    'next_retry_at',
                    models.DateTimeField(blank=True, db_index=True, null=True),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'stored_file_deletion_tasks',
                'ordering': ('created_at',),
                'constraints': [
                    models.UniqueConstraint(
                        fields=('storage_alias', 'storage_key'),
                        name='unique_stored_file_deletion_task',
                    ),
                ],
            },
        ),
    ]
