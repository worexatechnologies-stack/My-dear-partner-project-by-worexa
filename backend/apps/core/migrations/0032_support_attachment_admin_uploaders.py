from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0031_support_reply_admin_senders'),
    ]

    operations = [
        migrations.AddField(
            model_name='supportticketattachment',
            name='uploaded_by_admin',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='support_attachments',
                to='accounts.admin',
            ),
        ),
        migrations.AddField(
            model_name='supportticketattachment',
            name='uploaded_by_super_admin',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='support_attachments',
                to='accounts.superadmin',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='supportticketattachment',
            name='support_attachment_exactly_one_uploader',
        ),
        migrations.AddConstraint(
            model_name='supportticketattachment',
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(('uploaded_by_admin__isnull', True), ('uploaded_by_member__isnull', False), ('uploaded_by_super_admin__isnull', True), ('uploaded_by_support__isnull', True)),
                    models.Q(('uploaded_by_admin__isnull', True), ('uploaded_by_member__isnull', True), ('uploaded_by_super_admin__isnull', True), ('uploaded_by_support__isnull', False)),
                    models.Q(('uploaded_by_admin__isnull', False), ('uploaded_by_member__isnull', True), ('uploaded_by_super_admin__isnull', True), ('uploaded_by_support__isnull', True)),
                    models.Q(('uploaded_by_admin__isnull', True), ('uploaded_by_member__isnull', True), ('uploaded_by_super_admin__isnull', False), ('uploaded_by_support__isnull', True)),
                    _connector='OR',
                ),
                name='support_attachment_exactly_one_uploader',
            ),
        ),
    ]
