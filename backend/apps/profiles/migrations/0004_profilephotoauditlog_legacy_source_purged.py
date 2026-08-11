from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0001_stored_file_deletion_task"),
        ("profiles", "0003_postgresql_profile_photo_cutover"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profilephotoauditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("UPLOADED", "Uploaded"),
                    ("REPLACED", "Replaced"),
                    ("DELETED", "Deleted"),
                    ("SET_PRIMARY", "Set primary"),
                    ("REORDERED", "Reordered"),
                    ("APPROVED", "Approved"),
                    ("REJECTED", "Rejected"),
                    ("LEGACY_SOURCE_PURGED", "Legacy source purged"),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
    ]
