from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0036_sync_missing_plan_price_fields'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='membershipplan',
            name='monthly_profile_unlock_limit',
        ),
        migrations.RemoveField(
            model_name='membershipplan',
            name='contact_unlock_limit',
        ),
        migrations.RemoveField(
            model_name='membershipplan',
            name='direct_messaging_enabled',
        ),
        migrations.RemoveField(
            model_name='membershipplan',
            name='contact_access_level',
        ),
        migrations.RemoveField(
            model_name='membershipplan',
            name='advanced_search_enabled',
        ),
        migrations.RemoveField(
            model_name='membershipplan',
            name='razorpay_plan_reference',
        ),
        migrations.AlterField(
            model_name='membershipplan',
            name='message_limit_daily',
            field=models.IntegerField(blank=True, default=0, help_text='Null = unlimited', null=True),
        ),
    ]
