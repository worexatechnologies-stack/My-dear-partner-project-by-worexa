from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0032_support_attachment_admin_uploaders'),
    ]

    operations = [
        migrations.AddField(
            model_name='supportticketattachment',
            name='file_bytes',
            field=models.BinaryField(blank=True, null=True, editable=False),
        ),
        migrations.AddField(
            model_name='supportticketattachment',
            name='compression',
            field=models.CharField(blank=True, default='gzip', max_length=10),
        ),
        migrations.RemoveField(
            model_name='supportticketattachment',
            name='file_path',
        ),
    ]
