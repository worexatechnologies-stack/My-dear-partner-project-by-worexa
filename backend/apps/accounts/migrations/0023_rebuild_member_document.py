import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import apps.accounts.storage


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0022_document_verification_workflow'),
    ]

    operations = [
        # Remove old manager and add new fields
        migrations.AlterModelManagers(
            name='memberdocument',
            managers=[],
        ),
        # Remove old fields
        migrations.RemoveField(
            model_name='memberdocument',
            name='compressed_size',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='deleted_at',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='deleted_by_id',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='deletion_reason',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='is_deleted',
        ),
        # Remove old binary/file storage fields
        migrations.RemoveField(
            model_name='memberdocument',
            name='file_data',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='file_path',
        ),
        # Remove old file metadata fields
        migrations.RemoveField(
            model_name='memberdocument',
            name='file_content_type',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='file_name',
        ),
        # Remove old renamed field
        migrations.RemoveField(
            model_name='memberdocument',
            name='changes_requested_reason',
        ),
        # Remove old expiry field
        migrations.RemoveField(
            model_name='memberdocument',
            name='expiry_date',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='document_number',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='is_archived',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='archived_at',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='archived_from',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='reviewer_notes',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='uploaded_by_id',
        ),
        migrations.RemoveField(
            model_name='memberdocument',
            name='version_number',
        ),
        # Change status field - remove EXPIRED
        migrations.AlterField(
            model_name='memberdocument',
            name='status',
            field=models.CharField(choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')], default='PENDING', max_length=20),
        ),
        # Change document_type to add choices and shorter max_length
        migrations.AlterField(
            model_name='memberdocument',
            name='document_type',
            field=models.CharField(choices=[('AADHAAR', 'Aadhaar Card'), ('PAN', 'PAN Card'), ('PASSPORT', 'Passport'), ('DRIVING_LICENCE', 'Driving Licence'), ('VOTER_ID', 'Voter ID'), ('BIRTH_CERTIFICATE', 'Birth Certificate'), ('ADDRESS_PROOF', 'Address Proof'), ('INCOME_CERTIFICATE', 'Income Certificate'), ('DEGREE_CERTIFICATE', 'Degree Certificate'), ('TENTH_MARKSHEET', '10th Marks Card'), ('TWELFTH_MARKSHEET', '12th Marks Card'), ('DIPLOMA_CERTIFICATE', 'Diploma Certificate'), ('EMPLOYMENT_PROOF', 'Employment Proof'), ('SALARY_SLIP', 'Salary Slip'), ('DIVORCE_CERTIFICATE', 'Divorce Certificate'), ('DEATH_CERTIFICATE', 'Death Certificate'), ('OTHER', 'Other')], max_length=30),
        ),
        # Make file_size non-nullable
        migrations.AlterField(
            model_name='memberdocument',
            name='file_size',
            field=models.IntegerField(default=0),
            preserve_default=False,
        ),
        # Add new fields
        migrations.AddField(
            model_name='memberdocument',
            name='custom_document_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='original_file_name',
            field=models.CharField(default='document', max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='file',
            field=models.FileField(default='', upload_to='member_documents/', storage=apps.accounts.storage.PrivateMediaStorage()),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='mime_type',
            field=models.CharField(default='application/octet-stream', max_length=100),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='admin_comment',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
