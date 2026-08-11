from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0028_alter_memberdocument_file_hash'),
    ]

    operations = [
        migrations.AddField(
            model_name='member',
            name='last_seen_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Durable last-seen timestamp. Updated only on disconnect or at controlled intervals, never on every heartbeat.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='superadmin',
            name='last_seen_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Durable last-seen timestamp. Updated only on disconnect or at controlled intervals, never on every heartbeat.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='admin',
            name='last_seen_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Durable last-seen timestamp. Updated only on disconnect or at controlled intervals, never on every heartbeat.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='staff',
            name='last_seen_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Durable last-seen timestamp. Updated only on disconnect or at controlled intervals, never on every heartbeat.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='customersupportagent',
            name='last_seen_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Durable last-seen timestamp. Updated only on disconnect or at controlled intervals, never on every heartbeat.',
                null=True,
            ),
        ),
    ]
