from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_remove_member_member_verification_status_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='MemberActivityLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('actor_id', models.UUIDField(db_index=True)),
                ('action', models.CharField(db_index=True, max_length=100)),
                ('module', models.CharField(db_index=True, max_length=60)),
                ('target_type', models.CharField(blank=True, max_length=100)),
                ('target_id', models.CharField(blank=True, max_length=100)),
                ('description', models.TextField(blank=True)),
                ('old_data', models.JSONField(blank=True, default=dict)),
                ('new_data', models.JSONField(blank=True, default=dict)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                'db_table': 'member_activity_logs',
                'ordering': ('-created_at',),
                'abstract': False,
            },
        ),
    ]
