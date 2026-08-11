from django.db import migrations, models
import django.db.models.deletion
import uuid


def set_plan_ranks(apps, schema_editor):
    MembershipPlan = apps.get_model('core', 'MembershipPlan')
    rank_map = {
        'free': 1,
        'gold': 2,
        'platinum': 3,
        'premium': 3,
        'elite': 4,
    }
    for plan in MembershipPlan.objects.all():
        plan.rank = rank_map.get(plan.slug, 99)
        plan.save(update_fields=['rank'])


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0029_fix_payment_transaction_to_oto'),
    ]

    operations = [
        migrations.AddField(
            model_name='membershipplan',
            name='rank',
            field=models.IntegerField(default=99, help_text='Numeric rank for upgrade ordering (1=Free, 2=Gold, 3=Platinum, 4=Elite)'),
        ),
        migrations.AlterField(
            model_name='membermembership',
            name='status',
            field=models.CharField(choices=[
                ('PENDING_PAYMENT', 'Pending Payment'),
                ('ACTIVE', 'Active'),
                ('EXPIRING_SOON', 'Expiring Soon'),
                ('EXPIRED', 'Expired'),
                ('CANCELLED', 'Cancelled'),
                ('PAYMENT_FAILED', 'Payment Failed'),
                ('FAILED', 'Failed'),
                ('FREE', 'Free (legacy)'),
                ('PAYMENT_PENDING', 'Payment Pending (legacy)'),
                ('PENDING_VERIFICATION', 'Pending Verification (legacy)'),
                ('REFUNDED', 'Refunded (legacy)'),
            ], db_index=True, default='FREE', max_length=30),
        ),
        migrations.AddField(
            model_name='membermembership',
            name='activated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='membermembership',
            name='cancelled_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='membermembership',
            name='cancellation_reason',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='membermembership',
            name='auto_renew',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='membermembership',
            name='created_by',
            field=models.CharField(blank=True, help_text='Source of activation: member_request, admin_direct, payment_verified, free_activation, system', max_length=50),
        ),
        migrations.AddField(
            model_name='membermembership',
            name='notes',
            field=models.TextField(blank=True),
        ),
        migrations.CreateModel(
            name='NotificationDeliveryLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('notification_type', models.CharField(db_index=True, max_length=50)),
                ('milestone', models.CharField(blank=True, max_length=50)),
                ('channel', models.CharField(default='in_app', max_length=30)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('delivery_status', models.CharField(default='sent', max_length=30)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('membership', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notification_logs', to='core.membermembership')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notification_delivery_logs', to='accounts.member')),
            ],
            options={
                'db_table': 'notification_delivery_logs',
                'ordering': ('-sent_at',),
            },
        ),
        migrations.CreateModel(
            name='SupportExpiringMembership',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('contact_status', models.CharField(choices=[('pending', 'Pending'), ('contacted', 'Contacted'), ('follow_up', 'Follow Up'), ('resolved', 'Resolved')], default='pending', max_length=30)),
                ('assigned_agent_id', models.UUIDField(blank=True, null=True)),
                ('assigned_agent_name', models.CharField(blank=True, max_length=255)),
                ('last_contacted_at', models.DateTimeField(blank=True, null=True)),
                ('follow_up_notes', models.TextField(blank=True)),
                ('contacted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('membership', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='support_tracking', to='core.membermembership')),
            ],
            options={
                'db_table': 'support_expiring_memberships',
                'ordering': ('-created_at',),
            },
        ),
        migrations.RunPython(set_plan_ranks, reverse_code=migrations.RunPython.noop),
    ]
