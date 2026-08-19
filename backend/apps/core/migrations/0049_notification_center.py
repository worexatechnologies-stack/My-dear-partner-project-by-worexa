# Generated manually after the local virtual environment was found to point to
# a removed Python interpreter. Keep this migration additive for live data.

import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0048_alter_chatmessage_deletion_type_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='cleared_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(
                fields=['member_recipient', 'cleared_at', '-created_at'],
                name='notif_member_feed_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(
                fields=['member_recipient', 'cleared_at', 'is_read'],
                name='notif_member_unread_idx',
            ),
        ),
        migrations.CreateModel(
            name='WebPushSubscription',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('endpoint', models.TextField()),
                ('endpoint_hash', models.CharField(editable=False, max_length=64, unique=True)),
                ('p256dh', models.CharField(max_length=255)),
                ('auth', models.CharField(max_length=255)),
                ('user_agent', models.CharField(blank=True, max_length=1000)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                (
                    'member',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='web_push_subscriptions',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'db_table': 'web_push_subscriptions',
            },
        ),
        migrations.AddIndex(
            model_name='webpushsubscription',
            index=models.Index(fields=['member', 'is_active'], name='webpush_member_active_idx'),
        ),
    ]
