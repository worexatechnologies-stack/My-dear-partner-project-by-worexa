from django.db import migrations, models


def remove_deprecated_verification_setting(apps, _schema_editor):
    PlatformSetting = apps.get_model('core', 'PlatformSetting')
    setting = PlatformSetting.objects.filter(key='VERIFICATION').first()
    if setting is not None:
        value = dict(setting.value or {})
        value.pop('ai_verification_enabled', None)
        setting.value = value
        setting.description = 'Manual verification workflow and document requirements.'
        setting.save(update_fields=('value', 'description'))

    MembershipPlan = apps.get_model('core', 'MembershipPlan')
    for plan in MembershipPlan.objects.all().iterator():
        features = plan.features
        if not isinstance(features, list):
            continue
        updated_features = [
            'Rule-based compatibility preferences'
            if isinstance(feature, str) and feature.strip().casefold().endswith('matchmaking engine')
            else feature
            for feature in features
        ]
        if updated_features != features:
            plan.features = updated_features
            plan.save(update_fields=('features',))


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0044_supportticket_resolver_custom_id_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='interest',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('ACCEPTED', 'Accepted'),
                    ('DECLINED', 'Declined'),
                    ('WITHDRAWN', 'Withdrawn'),
                ],
                default='PENDING',
                max_length=10,
            ),
        ),
        migrations.RunPython(remove_deprecated_verification_setting, migrations.RunPython.noop),
    ]
