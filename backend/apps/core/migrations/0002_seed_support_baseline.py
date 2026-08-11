from django.db import migrations


CATEGORIES = {
    'GENERAL': 'General',
    'PAYMENTS': 'Payments',
    'PROFILE_VERIFICATION': 'Profile verification',
    'TECHNICAL': 'Technical',
    'REFUNDS': 'Refunds',
    'SAFETY': 'Safety',
}


def seed_support(apps, _schema_editor):
    Category = apps.get_model('core', 'SupportCategory')
    Sla = apps.get_model('core', 'SupportSlaRule')
    levels = (
        ('LOW', 480, 4320),
        ('NORMAL', 240, 2880),
        ('HIGH', 60, 720),
        ('URGENT', 15, 240),
    )
    for code, name in CATEGORIES.items():
        category, _ = Category.objects.update_or_create(
            code=code,
            defaults={'name': name, 'description': '', 'is_active': True},
        )
        for priority, response, resolution in levels:
            Sla.objects.update_or_create(
                category=category,
                priority=priority,
                defaults={
                    'first_response_minutes': response,
                    'resolution_minutes': resolution,
                    'is_active': True,
                },
            )


class Migration(migrations.Migration):
    dependencies = [('core', '0001_initial')]
    operations = [migrations.RunPython(seed_support, migrations.RunPython.noop)]
