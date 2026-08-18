from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0047_message_retention_and_audit'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chatmessage',
            name='deletion_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('FOR_ME', 'Deleted for me'),
                    ('FOR_EVERYONE', 'Deleted for everyone'),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name='chatmessage',
            index=models.Index(fields=['conversation', 'created_at'], name='chat_conversation_created_idx'),
        ),
    ]
