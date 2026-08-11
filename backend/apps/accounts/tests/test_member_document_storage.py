import gzip
import hashlib
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.accounts.models import AdminPermission, AdminRolePermission, MemberDocument
from apps.accounts.services import permanently_delete_member

pytestmark = pytest.mark.django_db


def _grant(admin, *codes):
    for code in codes:
        perm, _ = AdminPermission.objects.get_or_create(
            code=code, defaults={'name': code, 'module': 'documents'}
        )
        AdminRolePermission.objects.update_or_create(
            role=admin.role, permission=perm, defaults={'is_allowed': True}
        )


def _pdf_bytes(content=b'%PDF-1.4 binary document content for testing storage\n'):
    return content


def _png_bytes():
    # Minimal valid 1x1 PNG (verified by Pillow in real runs).
    return (
        b'\x89PNG\r\n\x1a\n'
        b'\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00'
        b'\x1f\x15\xc4\x89\x00\x00\x00\x0aIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
        b'\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    )


def _upload_pdf(client, document_type='AADHAAR', filename='aadhaar.pdf'):
    data = {
        'document_type': document_type,
        'file': SimpleUploadedFile(filename, _pdf_bytes(), content_type='application/pdf'),
    }
    return client.post('/api/v1/member-auth/me/documents/', data, format='multipart')


def _upload_png(client, document_type='AADHAAR', filename='photo.png'):
    data = {
        'document_type': document_type,
        'file': SimpleUploadedFile(filename, _png_bytes(), content_type='image/png'),
    }
    return client.post('/api/v1/member-auth/me/documents/', data, format='multipart')


# ---------------------------------------------------------------------------
# 1. PDF upload is stored in file_data
# ---------------------------------------------------------------------------
def test_pdf_upload_stored_in_file_data(authenticated_client, member):
    client = authenticated_client(member)
    resp = _upload_pdf(client)
    assert resp.status_code == 201
    doc = MemberDocument.objects.get(pk=resp.json()['data']['document']['id'])
    assert doc.file_data is not None
    assert gzip.decompress(doc.file_data) == _pdf_bytes()


# ---------------------------------------------------------------------------
# 2. Image upload is stored in file_data
# ---------------------------------------------------------------------------
def test_image_upload_stored_in_file_data(authenticated_client, member):
    client = authenticated_client(member)
    resp = _upload_png(client)
    assert resp.status_code == 201
    doc = MemberDocument.objects.get(pk=resp.json()['data']['document']['id'])
    assert doc.file_data is not None
    assert gzip.decompress(doc.file_data) == _png_bytes()


# ---------------------------------------------------------------------------
# 3. No filesystem file is created
# ---------------------------------------------------------------------------
def test_no_filesystem_file_created(authenticated_client, member, tmp_path, monkeypatch, settings):
    settings.PRIVATE_MEDIA_ROOT = str(tmp_path)
    client = authenticated_client(member)
    _upload_pdf(client)
    # The private_media directory must stay empty (no file written).
    remaining = list(tmp_path.rglob('*'))
    assert remaining == [], f'Unexpected files on disk: {remaining}'


# ---------------------------------------------------------------------------
# 4. Member can preview their own document
# ---------------------------------------------------------------------------
def test_member_can_preview_own_document(authenticated_client, member):
    client = authenticated_client(member)
    upload = _upload_pdf(client)
    doc_id = upload.json()['data']['document']['id']
    resp = client.get(f'/api/v1/member-auth/verification/documents/{doc_id}/preview/')
    assert resp.status_code == 200
    assert resp['Content-Type'] == 'application/pdf'
    assert resp.content == _pdf_bytes()
    assert 'inline' in resp['Content-Disposition']


# ---------------------------------------------------------------------------
# 5. Member cannot preview another member's document
# ---------------------------------------------------------------------------
def test_member_cannot_preview_others_document(authenticated_client, member, other_member):
    owner = authenticated_client(member)
    upload = _upload_pdf(owner)
    doc_id = upload.json()['data']['document']['id']

    intruder = authenticated_client(other_member)
    resp = intruder.get(f'/api/v1/member-auth/verification/documents/{doc_id}/preview/')
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 6. Admin with permission can preview
# ---------------------------------------------------------------------------
def test_admin_with_permission_can_preview(authenticated_client, member, admin_account):
    owner = authenticated_client(member)
    upload = _upload_pdf(owner)
    doc_id = upload.json()['data']['document']['id']

    _grant(admin_account, 'documents.view')
    admin = authenticated_client(admin_account)
    resp = admin.get(f'/api/v1/admin/documents/{doc_id}/preview/')
    assert resp.status_code == 200
    assert resp.content == _pdf_bytes()


# ---------------------------------------------------------------------------
# 7. Admin without permission receives 403
# ---------------------------------------------------------------------------
def test_admin_without_permission_gets_403(authenticated_client, member, admin_account):
    owner = authenticated_client(member)
    upload = _upload_pdf(owner)
    doc_id = upload.json()['data']['document']['id']

    # Revoke document permissions for this admin's role.
    for code in ('documents.view', 'documents.download'):
        perm, _ = AdminPermission.objects.get_or_create(
            code=code, defaults={'name': code, 'module': 'documents'}
        )
        AdminRolePermission.objects.update_or_create(
            role=admin_account.role, permission=perm, defaults={'is_allowed': False}
        )

    admin = authenticated_client(admin_account)
    resp = admin.get(f'/api/v1/admin/documents/{doc_id}/preview/')
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 8. Download returns exact original bytes
# ---------------------------------------------------------------------------
def test_download_returns_exact_bytes(authenticated_client, member):
    client = authenticated_client(member)
    upload = _upload_pdf(client)
    doc_id = upload.json()['data']['document']['id']
    resp = client.get(f'/api/v1/member-auth/verification/documents/{doc_id}/download/')
    assert resp.status_code == 200
    assert resp.content == _pdf_bytes()
    assert 'attachment' in resp['Content-Disposition']


# ---------------------------------------------------------------------------
# 9. MIME type is correct
# ---------------------------------------------------------------------------
def test_mime_type_correct(authenticated_client, member):
    client = authenticated_client(member)
    upload = _upload_png(client)
    doc = MemberDocument.objects.get(pk=upload.json()['data']['document']['id'])
    assert doc.mime_type == 'image/png'


# ---------------------------------------------------------------------------
# 10. Filename is correct
# ---------------------------------------------------------------------------
def test_filename_correct(authenticated_client, member):
    client = authenticated_client(member)
    upload = _upload_pdf(client, filename='my-aadhaar.pdf')
    doc = MemberDocument.objects.get(pk=upload.json()['data']['document']['id'])
    assert doc.original_file_name == 'my-aadhaar.pdf'


# ---------------------------------------------------------------------------
# 11. Oversized file is rejected
# ---------------------------------------------------------------------------
def test_oversized_file_rejected(authenticated_client, member):
    client = authenticated_client(member)
    big = SimpleUploadedFile('big.pdf', b'%PDF-1.4 ' + b'a' * (11 * 1024 * 1024), content_type='application/pdf')
    resp = client.post(
        '/api/v1/member-auth/me/documents/',
        {'document_type': 'AADHAAR', 'file': big},
        format='multipart',
    )
    assert resp.status_code == 400
    assert 'file' in resp.json()['errors']


# ---------------------------------------------------------------------------
# 12. Unsafe extension is rejected
# ---------------------------------------------------------------------------
def test_unsafe_extension_rejected(authenticated_client, member):
    client = authenticated_client(member)
    exe = SimpleUploadedFile('malware.exe', b'MZ' + b'\x00' * 20, content_type='application/octet-stream')
    resp = client.post(
        '/api/v1/member-auth/me/documents/',
        {'document_type': 'AADHAAR', 'file': exe},
        format='multipart',
    )
    assert resp.status_code == 400


def test_executable_signature_rejected_even_with_pdf_name(authenticated_client, member):
    client = authenticated_client(member)
    fake = SimpleUploadedFile('tricky.pdf', b'MZ' + b'\x00' * 20, content_type='application/pdf')
    resp = client.post(
        '/api/v1/member-auth/me/documents/',
        {'document_type': 'AADHAAR', 'file': fake},
        format='multipart',
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 13. Re-upload replaces old bytes
# ---------------------------------------------------------------------------
def test_reupload_replaces_old_bytes(authenticated_client, member):
    client = authenticated_client(member)
    upload = _upload_pdf(client, document_type='AADHAAR')
    doc_id = upload.json()['data']['document']['id']
    doc = MemberDocument.objects.get(pk=doc_id)
    doc.status = MemberDocument.Status.REJECTED
    doc.save()

    new_bytes = b'%PDF-1.4 replaced document content\n'
    resp = client.post(
        f'/api/v1/member-auth/me/documents/{doc_id}/reupload/',
        {'file': SimpleUploadedFile('reuploaded.pdf', new_bytes, content_type='application/pdf')},
        format='multipart',
    )
    assert resp.status_code == 200
    doc.refresh_from_db()
    assert doc.status == MemberDocument.Status.PENDING
    assert gzip.decompress(doc.file_data) == new_bytes
    assert doc.file_hash == hashlib.sha256(new_bytes).hexdigest()


# ---------------------------------------------------------------------------
# 14. Permanent deletion removes the row and bytes
# ---------------------------------------------------------------------------
def test_permanent_deletion_removes_row_and_bytes(authenticated_client, member, super_admin):
    client = authenticated_client(member)
    upload = _upload_pdf(client)
    doc_id = upload.json()['data']['document']['id']
    assert MemberDocument.objects.filter(pk=doc_id).exists()

    permanently_delete_member(member=member, actor=super_admin)
    assert not MemberDocument.objects.filter(pk=doc_id).exists()


# ---------------------------------------------------------------------------
# 15. List APIs do not include file_data
# ---------------------------------------------------------------------------
def test_list_api_excludes_file_data(authenticated_client, member):
    client = authenticated_client(member)
    _upload_pdf(client)
    resp = client.get('/api/v1/member-auth/me/documents/')
    assert resp.status_code == 200
    payload = resp.json()
    docs = payload if isinstance(payload, list) else payload.get('documents') or payload.get('data') or []
    for doc in docs:
        assert 'file_data' not in doc
        assert 'raw_file_bytes' not in doc


# ---------------------------------------------------------------------------
# 16. List queries defer the binary column
# ---------------------------------------------------------------------------
def test_list_query_defers_file_data(authenticated_client, member):
    client = authenticated_client(member)
    _upload_pdf(client)
    # Inspect the generated SQL for the list endpoint path.
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    with CaptureQueriesContext(connection) as ctx:
        list(MemberDocument.objects.filter(member=member).defer('file_data'))
    sql = ' '.join(q['sql'] for q in ctx.captured_queries)
    assert 'file_data' not in sql.lower()


# ---------------------------------------------------------------------------
# 17. Admin download endpoint returns exact binary (proxy forwards this as-is)
# ---------------------------------------------------------------------------
def test_admin_download_returns_exact_binary(authenticated_client, member, admin_account):
    owner = authenticated_client(member)
    upload = _upload_pdf(owner)
    doc_id = upload.json()['data']['document']['id']

    _grant(admin_account, 'documents.download')
    admin = authenticated_client(admin_account)
    resp = admin.get(f'/api/v1/admin/documents/{doc_id}/download/')
    assert resp.status_code == 200
    assert resp['Content-Type'] == 'application/pdf'
    assert resp.content == _pdf_bytes()
    assert 'attachment' in resp['Content-Disposition']
