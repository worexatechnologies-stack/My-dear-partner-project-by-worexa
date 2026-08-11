from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0024_cleanup_remaining'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='memberdocument',
            name='member_docu_member__5f8afd_idx',
        ),
        migrations.RemoveIndex(
            model_name='memberdocument',
            name='member_docu_member__ed529b_idx',
        ),
        migrations.AlterField(
            model_name='memberdocument',
            name='uploaded_at',
            field=models.DateTimeField(auto_now_add=True),
        ),
    ]
