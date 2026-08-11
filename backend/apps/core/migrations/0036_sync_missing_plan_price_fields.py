from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0035_remove_membershipplan_daily_message_limit'),
    ]

    state_operations = [
        migrations.AddField(
            model_name='membershipplan',
            name='price_3m',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='membershipplan',
            name='price_6m',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='membershipplan',
            name='price_1y',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='membershipplan',
            name='discount_3m',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='membershipplan',
            name='discount_6m',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='membershipplan',
            name='discount_1y',
            field=models.CharField(blank=True, max_length=50),
        ),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(state_operations=state_operations),
    ]
