from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0019_member_activity_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='memberdocument',
            name='file_data',
            field=models.BinaryField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='file_name',
            field=models.CharField(max_length=255, blank=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='file_content_type',
            field=models.CharField(max_length=100, blank=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='file_size',
            field=models.IntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='compressed_size',
            field=models.IntegerField(null=True, blank=True),
        ),
    ]
