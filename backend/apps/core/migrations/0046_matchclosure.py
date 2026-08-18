import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0045_interest_withdrawal_and_cleanup_settings'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MatchClosure',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('closed_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('closed_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='closed_matches', to=settings.AUTH_USER_MODEL)),
                ('interest', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='match_closure', to='core.interest')),
            ],
            options={
                'db_table': 'match_closures',
                'ordering': ('-closed_at',),
            },
        ),
        migrations.AddIndex(
            model_name='matchclosure',
            index=models.Index(fields=['closed_by', 'closed_at'], name='match_close_by_date_idx'),
        ),
    ]
