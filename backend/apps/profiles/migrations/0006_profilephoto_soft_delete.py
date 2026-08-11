"""Add soft-delete fields to ProfilePhoto model."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0005_userprofileimage"),
    ]

    operations = [
        migrations.AddField(
            model_name="profilephoto",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="profilephoto",
            name="is_deleted",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
