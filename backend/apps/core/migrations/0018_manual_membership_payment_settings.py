from django.db import migrations


def remove_gateway_settings(apps, schema_editor):
    PlatformSetting = apps.get_model('core', 'PlatformSetting')
    setting = PlatformSetting.objects.filter(key='PAYMENT').first()
    if setting is None:
        return
    setting.description = 'Manual membership approval, currency, and refund policy.'
    setting.value = {
        'approval_mode': 'manual_approval',
        'currency': 'INR',
        'refund_days_limit': 7,
    }
    setting.save(update_fields=('description', 'value', 'updated_at'))


class Migration(migrations.Migration):
    dependencies = [('core', '0017_chatmessage_chat_sender_recv_created_idx')]

    operations = [migrations.RunPython(remove_gateway_settings, migrations.RunPython.noop)]
