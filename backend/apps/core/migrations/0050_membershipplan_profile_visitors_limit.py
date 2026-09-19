from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0049_notification_center'),
    ]

    operations = [
        migrations.AddField(
            model_name='membershipplan',
            name='profile_visitors_limit',
            field=models.IntegerField(
                blank=True,
                default=4,
                help_text='Max profile visitors visible to member (e.g. 4 for basic/free, Null for unlimited)',
                null=True,
            ),
        ),
    ]
