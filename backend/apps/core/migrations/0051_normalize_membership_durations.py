from django.db import migrations


def normalize_durations(apps, schema_editor):
    MembershipPlan = apps.get_model('core', 'MembershipPlan')
    tiers = {
        'gold': {
            'price': 1199.00,
            'price_3m': 2999.00,
            'price_6m': 4999.00,
            'price_1y': 7999.00,
            'discount_3m': '17% OFF',
            'discount_6m': '31% OFF',
            'discount_1y': '44% OFF',
        },
        'elite': {
            'price': 1499.00,
            'price_3m': 3499.00,
            'price_6m': 5999.00,
            'price_1y': 9999.00,
            'discount_3m': '22% OFF',
            'discount_6m': '33% OFF',
            'discount_1y': '44% OFF',
        },
        'premium': {
            'price': 1999.00,
            'price_3m': 4999.00,
            'price_6m': 8999.00,
            'price_1y': 14999.00,
            'discount_3m': '17% OFF',
            'discount_6m': '25% OFF',
            'discount_1y': '37% OFF',
        },
    }
    for plan in MembershipPlan.objects.all():
        updated_fields = []
        if plan.duration_days in (90, 180, 360, 365) or plan.duration_days != 30:
            plan.duration_days = 30
            plan.duration = '30 Days'
            updated_fields.extend(['duration_days', 'duration'])

        t = tiers.get(plan.slug)
        if t:
            if not plan.price_3m:
                plan.price_3m = t['price_3m']
                plan.discount_3m = t['discount_3m']
                updated_fields.extend(['price_3m', 'discount_3m'])
            if not plan.price_6m:
                plan.price_6m = t['price_6m']
                plan.discount_6m = t['discount_6m']
                updated_fields.extend(['price_6m', 'discount_6m'])
            if not plan.price_1y:
                plan.price_1y = t['price_1y']
                plan.discount_1y = t['discount_1y']
                updated_fields.extend(['price_1y', 'discount_1y'])
            if float(plan.price) in (2999.0, 5999.0, 14999.0, 0.0) and plan.slug != 'free':
                plan.price = t['price']
                updated_fields.append('price')
        if updated_fields:
            plan.save(update_fields=list(set(updated_fields)))


def reverse_normalize(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0050_membershipplan_profile_visitors_limit'),
    ]

    operations = [
        migrations.RunPython(normalize_durations, reverse_normalize),
    ]
