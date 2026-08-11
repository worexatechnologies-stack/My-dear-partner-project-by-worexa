from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0018_manual_membership_payment_settings")]

    operations = [
        migrations.AddIndex(
            model_name="profileviewlog",
            index=models.Index(fields=["viewed", "-viewed_at"], name="profile_view_log_viewed_recent"),
        ),
    ]
