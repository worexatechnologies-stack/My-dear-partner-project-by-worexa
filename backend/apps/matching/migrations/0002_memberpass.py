import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_user'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('matching', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MemberPass',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='passed_by_members', to='accounts.memberprofile')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='member_passes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'member_passes',
                'ordering': ('-created_at',),
            },
        ),
        migrations.AddConstraint(
            model_name='memberpass',
            constraint=models.UniqueConstraint(fields=('user', 'profile'), name='unique_member_pass'),
        ),
    ]
