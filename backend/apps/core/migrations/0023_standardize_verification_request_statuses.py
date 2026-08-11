# Generated migration for standardizing ProfileVerificationRequest statuses

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_formalize_membership_plan_entitlements'),
    ]

    operations = [
        migrations.AlterField(
            model_name='profileverificationrequest',
            name='status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('pending_review', 'Pending Review'),
                    ('in_review', 'In Review'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                    ('changes_requested', 'Changes Requested'),
                ],
                default='pending_review',
                db_index=True,
            ),
        ),
        
        # Add reviewed_by fields for audit trail
        migrations.AddField(
            model_name='profileverificationrequest',
            name='reviewed_by_admin',
            field=models.ForeignKey(
                'accounts.Admin',
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
                related_name='reviewed_verifications',
            ),
        ),
        migrations.AddField(
            model_name='profileverificationrequest',
            name='reviewed_by_super_admin',
            field=models.ForeignKey(
                'accounts.SuperAdmin',
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
                related_name='reviewed_verifications',
            ),
        ),
        migrations.AddField(
            model_name='profileverificationrequest',
            name='reviewed_by_staff',
            field=models.ForeignKey(
                'accounts.Staff',
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
                related_name='reviewed_verifications',
            ),
        ),
        
        # Migrate old status values
        migrations.RunSQL(
            sql="""
                UPDATE profile_verification_requests SET status = 
                    CASE 
                        WHEN status IN ('PENDING', 'ASSIGNED') THEN 'pending_review'
                        WHEN status IN ('IN_REVIEW', 'RESUBMITTED') THEN 'in_review'
                        WHEN status = 'APPROVED' THEN 'approved'
                        WHEN status = 'REJECTED' THEN 'rejected'
                        WHEN status = 'ESCALATED' THEN 'changes_requested'
                        ELSE 'pending_review'
                    END;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
