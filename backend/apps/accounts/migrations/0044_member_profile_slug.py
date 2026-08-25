import secrets

from django.db import migrations, models
from django.utils.text import slugify


def _unique_slug(member):
    """Replicate the model's slug generation for a one-time backfill."""
    base = slugify(f"{member.first_name} {member.last_name}")[:60].strip().strip('-')
    if not base:
        base = 'member'
    candidate = base
    for _ in range(8):
        if not member.__class__.objects.filter(profile_slug=candidate).exclude(pk=member.pk).exists():
            return candidate
        candidate = f"{base}-{secrets.token_hex(2)}"[:120]
    return f"{base}-{secrets.token_hex(4)}"[:120]


def backfill_profile_slugs(apps, schema_editor):
    Member = apps.get_model('accounts', 'Member')
    for member in Member.objects.filter(profile_slug__isnull=True).iterator():
        member.profile_slug = _unique_slug(member)
        member.save(update_fields=['profile_slug'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0043_member_deletion_lifecycle'),
    ]

    operations = [
        migrations.AddField(
            model_name='member',
            name='profile_slug',
            field=models.CharField(
                db_index=True,
                max_length=120,
                blank=True,
                null=True,
                unique=True,
            ),
        ),
        migrations.RunPython(backfill_profile_slugs, migrations.RunPython.noop),
    ]