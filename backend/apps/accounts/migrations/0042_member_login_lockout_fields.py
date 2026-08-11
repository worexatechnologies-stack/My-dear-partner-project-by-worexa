from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0041_increase_admin_photo_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='member',
            name='failed_login_attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='member',
            name='locked_until',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
