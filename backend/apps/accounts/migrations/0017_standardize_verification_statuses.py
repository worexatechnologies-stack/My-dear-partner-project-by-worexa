# Generated migration for standardizing verification statuses

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_grant_admin_member_deletion'),
    ]

    operations = [
        # Add new standardized status fields
        migrations.AlterField(
            model_name='member',
            name='profile_status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('not_started', 'Not Started'),
                    ('draft', 'Draft'),
                    ('pending_review', 'Pending Review'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                    ('changes_requested', 'Changes Requested'),
                ],
                default='not_started',
                db_index=True,
            ),
        ),
        migrations.AlterField(
            model_name='member',
            name='photo_status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('not_started', 'Not Started'),
                    ('pending_review', 'Pending Review'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                    ('changes_requested', 'Changes Requested'),
                ],
                default='not_started',
                db_index=True,
            ),
        ),
        migrations.AlterField(
            model_name='member',
            name='document_status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('not_started', 'Not Started'),
                    ('pending_review', 'Pending Review'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                    ('changes_requested', 'Changes Requested'),
                ],
                default='not_started',
                db_index=True,
            ),
        ),
        
        # Add rejection reason fields
        migrations.AddField(
            model_name='member',
            name='profile_rejection_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='member',
            name='photo_rejection_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='member',
            name='document_rejection_reason',
            field=models.TextField(blank=True, default=''),
        ),
        
        # Add reviewed timestamps
        migrations.AddField(
            model_name='member',
            name='profile_reviewed_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='member',
            name='photo_reviewed_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='member',
            name='document_reviewed_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        
        # Add submission timestamps
        migrations.AddField(
            model_name='member',
            name='profile_submitted_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='member',
            name='photo_submitted_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='member',
            name='document_submitted_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        
        # Migrate old values to new standardized values
        migrations.RunSQL(
            sql="""
                UPDATE members SET profile_status = 
                    CASE 
                        WHEN profile_status = 'DRAFT' THEN 'draft'
                        WHEN profile_status IN ('PENDING', 'IN_REVIEW', 'RESUBMITTED') THEN 'pending_review'
                        WHEN profile_status = 'APPROVED' THEN 'approved'
                        WHEN profile_status = 'REJECTED' THEN 'rejected'
                        WHEN profile_status = 'NOT_SUBMITTED' THEN 'not_started'
                        ELSE 'not_started'
                    END;
                    
                UPDATE members SET photo_status = 
                    CASE 
                        WHEN photo_status = 'PENDING' THEN 'pending_review'
                        WHEN photo_status = 'APPROVED' THEN 'approved'
                        WHEN photo_status = 'REJECTED' THEN 'rejected'
                        WHEN photo_status = 'ARCHIVED' THEN 'not_started'
                        ELSE 'not_started'
                    END;
                    
                UPDATE members SET document_status = 
                    CASE 
                        WHEN document_status IN ('PENDING') THEN 'pending_review'
                        WHEN document_status = 'APPROVED' THEN 'approved'
                        WHEN document_status = 'REJECTED' THEN 'rejected'
                        WHEN document_status IN ('NOT_UPLOADED', 'EXPIRED') THEN 'not_started'
                        ELSE 'not_started'
                    END;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        
        # Add indexes for performance
        migrations.AddIndex(
            model_name='member',
            index=models.Index(
                fields=['profile_status', 'photo_status', 'document_status'],
                name='member_verification_status_idx'
            ),
        ),
    ]
