# Generated manually to allow NULL (unlimited) for profile_view_limit_daily and interest_limit_daily
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0051_normalize_membership_durations'),
    ]

    operations = [
        migrations.AlterField(
            model_name='membershipplan',
            name='profile_view_limit_daily',
            field=models.IntegerField(blank=True, default=10, help_text='Null = unlimited', null=True),
        ),
        migrations.AlterField(
            model_name='membershipplan',
            name='interest_limit_daily',
            field=models.IntegerField(blank=True, default=3, help_text='Null = unlimited', null=True),
        ),
    ]
