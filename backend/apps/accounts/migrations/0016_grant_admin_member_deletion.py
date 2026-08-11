from django.db import migrations


def grant_admin_member_deletion(apps, schema_editor):
    AdminPermission = apps.get_model('accounts', 'AdminPermission')
    AdminRole = apps.get_model('accounts', 'AdminRole')
    AdminRolePermission = apps.get_model('accounts', 'AdminRolePermission')

    permission, _ = AdminPermission.objects.get_or_create(
        code='members.delete',
        defaults={
            'name': 'Delete members',
            'module': 'members',
            'description': '',
        },
    )
    role = AdminRole.objects.filter(code='ADMIN').first()
    if role:
        AdminRolePermission.objects.update_or_create(
            role=role,
            permission=permission,
            defaults={'is_allowed': True},
        )


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0015_finalize_legacy_profile_photo_cutover'),
    ]

    operations = [
        migrations.RunPython(grant_admin_member_deletion, migrations.RunPython.noop),
    ]
