from django.db import migrations


def migrate_messages_and_notifications_to_plaintext(apps, schema_editor):
    ChatMessage = apps.get_model('core', 'ChatMessage')
    Notification = apps.get_model('core', 'Notification')

    # Import the decrypt helper from message_service
    from apps.core.message_service import decrypt_retained_message_text

    for m in ChatMessage.objects.all():
        if m.text and (m.text.startswith('__E2EE__:') or '_E2EE_' in m.text or '"iv":' in m.text):
            plain = decrypt_retained_message_text(m)
            if plain and not plain.startswith('__E2EE__:') and plain != 'Encrypted message unavailable':
                m.text = plain
                m.save(update_fields=['text'])

    for n in Notification.objects.filter(notification_type='CHAT_MESSAGE'):
        if n.message and ('__E2EE__:' in n.message or '_E2EE_' in n.message or '"iv":' in n.message):
            if n.related_object_id:
                try:
                    msg = ChatMessage.objects.get(pk=n.related_object_id)
                    n.message = msg.text[:100]
                    n.save(update_fields=['message'])
                except ChatMessage.DoesNotExist:
                    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0053_membershipplan_can_view_full_profile'),
    ]

    operations = [
        migrations.RunPython(
            migrate_messages_and_notifications_to_plaintext,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
