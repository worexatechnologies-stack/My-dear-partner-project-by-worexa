import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0044_member_profile_slug'),
    ]

    operations = [
        migrations.CreateModel(
            name='MemberAccountSettings',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('push_notifications', models.BooleanField(default=True)),
                ('email_notifications', models.BooleanField(default=True)),
                ('notification_preferences', models.JSONField(blank=True, default=dict, help_text='Granular notification preferences (e.g. chat, interests, matches, marketing).')),
                ('show_online_status', models.BooleanField(default=True)),
                ('contact_visibility', models.CharField(choices=[('ALL', 'All Members'), ('CONNECTED_ONLY', 'Connected / Mutual Matches Only'), ('HIDDEN', 'Hidden')], default='CONNECTED_ONLY', max_length=20)),
                ('photo_visibility', models.CharField(choices=[('ALL', 'All Members'), ('CONNECTED_ONLY', 'Connected / Mutual Matches Only'), ('APPROVED_MEMBERS', 'Approved / Verified Members Only')], default='ALL', max_length=20)),
                ('eligibility_consent', models.BooleanField(default=False)),
                ('eligibility_policy_version', models.CharField(default='v1.0', max_length=30)),
                ('eligibility_consented_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('member', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='account_settings', to='accounts.member')),
            ],
            options={
                'db_table': 'member_account_settings',
            },
        ),
    ]
