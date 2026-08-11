from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0030_membership_lifecycle'),
    ]

    operations = [
        migrations.AddField(
            model_name='supportticketreply',
            name='admin_sender',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='support_replies',
                to='accounts.admin',
            ),
        ),
        migrations.AddField(
            model_name='supportticketreply',
            name='super_admin_sender',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='support_replies',
                to='accounts.superadmin',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='supportticketreply',
            name='support_reply_exactly_one_sender',
        ),
        migrations.AddConstraint(
            model_name='supportticketreply',
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(('admin_sender__isnull', True), ('member_sender__isnull', False), ('super_admin_sender__isnull', True), ('support_sender__isnull', True)),
                    models.Q(('admin_sender__isnull', True), ('member_sender__isnull', True), ('super_admin_sender__isnull', True), ('support_sender__isnull', False)),
                    models.Q(('admin_sender__isnull', False), ('member_sender__isnull', True), ('super_admin_sender__isnull', True), ('support_sender__isnull', True)),
                    models.Q(('admin_sender__isnull', True), ('member_sender__isnull', True), ('super_admin_sender__isnull', False), ('support_sender__isnull', True)),
                    _connector='OR',
                ),
                name='support_reply_exactly_one_sender',
            ),
        ),
    ]
