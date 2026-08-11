from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0023_standardize_verification_request_statuses'),
    ]

    operations = [
        migrations.AlterField(
            model_name='membershiprequest',
            name='selected_plan',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='membership_requests',
                to='core.membershipplan',
            ),
        ),
        migrations.AlterField(
            model_name='payment',
            name='plan',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='payments',
                to='core.membershipplan',
            ),
        ),
    ]
