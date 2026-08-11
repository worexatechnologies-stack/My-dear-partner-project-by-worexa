from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_membershipplan_discount_1y_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='membershipplan',
            name='daily_message_limit',
        ),
    ]
