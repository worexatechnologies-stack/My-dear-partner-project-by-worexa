import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def _display_name(member):
    if not member:
        return ''
    return ' '.join(part for part in (member.first_name, member.last_name) if part).strip() or member.email


def populate_conversations(apps, schema_editor):
    ChatMessage = apps.get_model('core', 'ChatMessage')
    ChatConversation = apps.get_model('core', 'ChatConversation')
    ChatConversationParticipant = apps.get_model('core', 'ChatConversationParticipant')
    Member = apps.get_model('accounts', 'Member')

    pair_ids = ChatMessage.objects.values_list('sender_id', 'receiver_id').distinct().iterator()
    for sender_id, receiver_id in pair_ids:
        if not sender_id or not receiver_id or sender_id == receiver_id:
            continue
        first_id, second_id = sorted((sender_id, receiver_id), key=str)
        first = Member.objects.filter(pk=first_id).first()
        second = Member.objects.filter(pk=second_id).first()
        if not first or not second:
            continue

        conversation, _ = ChatConversation.objects.get_or_create(
            member_one_id_snapshot=first_id,
            member_two_id_snapshot=second_id,
            defaults={
                'member_one_id': first_id,
                'member_two_id': second_id,
                'member_one_name_snapshot': _display_name(first),
                'member_two_name_snapshot': _display_name(second),
            },
        )
        ChatConversationParticipant.objects.get_or_create(
            conversation_id=conversation.pk,
            member_id_snapshot=first_id,
            defaults={'member_id': first_id, 'display_name_snapshot': _display_name(first)},
        )
        ChatConversationParticipant.objects.get_or_create(
            conversation_id=conversation.pk,
            member_id_snapshot=second_id,
            defaults={'member_id': second_id, 'display_name_snapshot': _display_name(second)},
        )

        messages = ChatMessage.objects.filter(
            sender_id__in=(first_id, second_id),
            receiver_id__in=(first_id, second_id),
        ).filter(conversation_id__isnull=True)
        for message in messages.iterator(chunk_size=500):
            sender = first if message.sender_id == first_id else second
            receiver = second if message.receiver_id == second_id else first
            message.conversation_id = conversation.pk
            message.sender_id_snapshot = message.sender_id
            message.receiver_id_snapshot = message.receiver_id
            message.sender_name_snapshot = _display_name(sender)
            message.receiver_name_snapshot = _display_name(receiver)
            message.save(update_fields=(
                'conversation', 'sender_id_snapshot', 'receiver_id_snapshot',
                'sender_name_snapshot', 'receiver_name_snapshot',
            ))


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0043_member_deletion_lifecycle'),
        ('core', '0046_matchclosure'),
    ]

    operations = [
        migrations.CreateModel(
            name='ChatConversation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('member_one_id_snapshot', models.UUIDField(db_index=True)),
                ('member_two_id_snapshot', models.UUIDField(db_index=True)),
                ('member_one_name_snapshot', models.CharField(blank=True, max_length=255)),
                ('member_two_name_snapshot', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('last_message_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('member_one', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='chat_conversations_as_one', to=settings.AUTH_USER_MODEL)),
                ('member_two', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='chat_conversations_as_two', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'chat_conversations',
                'indexes': [models.Index(fields=['member_one', 'member_two'], name='chat_conv_member_pair_idx')],
                'constraints': [models.UniqueConstraint(fields=('member_one_id_snapshot', 'member_two_id_snapshot'), name='unique_chat_member_pair_snapshot')],
            },
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='conversation',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='messages', to='core.chatconversation'),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='deleted_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='deleted_for_everyone',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='deletion_type',
            field=models.CharField(blank=True, db_index=True, max_length=20),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='metadata',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='message_type',
            field=models.CharField(choices=[('TEXT', 'Text'), ('IMAGE', 'Image'), ('VIDEO', 'Video'), ('VOICE', 'Voice'), ('DOCUMENT', 'Document'), ('GIF', 'GIF')], db_index=True, default='TEXT', max_length=20),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='receiver_id_snapshot',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='receiver_name_snapshot',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='retention_expires_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='sender_id_snapshot',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='sender_name_snapshot',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='chatmessage',
            name='deleted_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deleted_chat_messages', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='chatmessage',
            name='receiver',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='received_messages', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='chatmessage',
            name='sender',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sent_messages', to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name='ChatConversationParticipant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('member_id_snapshot', models.UUIDField(db_index=True)),
                ('display_name_snapshot', models.CharField(blank=True, max_length=255)),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('left_at', models.DateTimeField(blank=True, null=True)),
                ('conversation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participants', to='core.chatconversation')),
                ('member', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='chat_participations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'chat_conversation_participants',
                'indexes': [
                    models.Index(fields=['member', 'left_at'], name='chat_participant_member_idx'),
                    models.Index(fields=['conversation', 'left_at'], name='chat_participant_conv_idx'),
                ],
                'constraints': [models.UniqueConstraint(fields=('conversation', 'member_id_snapshot'), name='unique_chat_conversation_participant')],
            },
        ),
        migrations.CreateModel(
            name='ChatMessageUserVisibility',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_id_snapshot', models.UUIDField(db_index=True)),
                ('hidden', models.BooleanField(default=True)),
                ('hidden_at', models.DateTimeField(auto_now_add=True)),
                ('message', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_visibility', to='core.chatmessage')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='chat_message_visibility', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'chat_message_user_visibility',
                'indexes': [models.Index(fields=['user_id_snapshot', 'hidden'], name='chat_visibility_user_idx')],
                'constraints': [models.UniqueConstraint(fields=('message', 'user_id_snapshot'), name='unique_chat_message_user_visibility')],
            },
        ),
        migrations.CreateModel(
            name='ChatMessageAttachment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('storage_key', models.CharField(max_length=1024)),
                ('file_name', models.CharField(max_length=255)),
                ('mime_type', models.CharField(max_length=255)),
                ('file_size', models.PositiveBigIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('deleted_from_user_view', models.BooleanField(default=False)),
                ('message', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='core.chatmessage')),
            ],
            options={
                'db_table': 'chat_message_attachments',
                'indexes': [models.Index(fields=['message', 'created_at'], name='chat_attachment_message_idx')],
            },
        ),
        migrations.CreateModel(
            name='AdminMessageAccessLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('conversation_id_snapshot', models.UUIDField(blank=True, db_index=True, null=True)),
                ('message_id_snapshot', models.UUIDField(blank=True, db_index=True, null=True)),
                ('action', models.CharField(choices=[('VIEW_CONVERSATION', 'View conversation'), ('VIEW_MESSAGE', 'View message'), ('VIEW_DELETED_MESSAGE', 'View deleted message'), ('SEARCH_MESSAGES', 'Search messages'), ('VIEW_ATTACHMENT', 'View attachment')], db_index=True, max_length=30)),
                ('reason', models.CharField(max_length=500)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('admin_user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='message_access_logs', to='accounts.superadmin')),
                ('conversation', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='admin_access_logs', to='core.chatconversation')),
                ('message', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='admin_access_logs', to='core.chatmessage')),
            ],
            options={
                'db_table': 'admin_message_access_logs',
                'indexes': [
                    models.Index(fields=['admin_user', 'created_at'], name='chat_admin_access_admin_idx'),
                    models.Index(fields=['action', 'created_at'], name='chat_admin_access_action_idx'),
                ],
            },
        ),
        migrations.RunPython(populate_conversations, migrations.RunPython.noop),
    ]
