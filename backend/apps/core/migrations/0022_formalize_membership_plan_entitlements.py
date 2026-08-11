from django.db import migrations


def populate_entitlements(apps, schema_editor):
    MembershipPlan = apps.get_model('core', 'MembershipPlan')
    for plan in MembershipPlan.objects.all():
        values = dict(plan.entitlements or {})
        values.update({
            'daily_profile_view_limit': plan.daily_profile_unlock_limit if plan.daily_profile_unlock_limit is not None else plan.profile_view_limit_daily,
            'can_send_interest': plan.can_send_interest,
            'daily_interest_limit': plan.interest_limit if plan.interest_limit is not None else plan.interest_limit_daily,
            'can_chat': plan.can_message or plan.messaging_mode != 'DISABLED',
            'can_view_contact_details': plan.can_view_contact or plan.contact_access_mode != 'NONE',
            'profile_visibility_boost': plan.can_use_profile_boost or plan.profile_boost_level != 'NONE',
            'can_see_who_viewed_profile': plan.can_view_profile_visitors,
            'can_view_received_interests': plan.can_view_received_interests,
            'priority_support': plan.support_priority == 'HIGH',
            'max_photos': values.get('max_photos', 6),
            'contact_access_mode': plan.contact_access_mode,
            'photo_access_mode': plan.photo_access_mode,
            'can_use_advanced_search': plan.can_use_advanced_search,
        })
        plan.entitlements = values
        plan.save(update_fields=('entitlements',))


class Migration(migrations.Migration):
    dependencies = [('core', '0021_membershipplan_can_view_received_interests')]
    operations = [migrations.RunPython(populate_entitlements, migrations.RunPython.noop)]
