import gzip
import json

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

from apps.accounts.models import Member, MemberDocument, SuperAdminActivityLog
from apps.accounts.services import permanently_delete_member
from apps.profiles.models import ProfilePhoto, ProfilePhotoAuditLog


pytestmark = pytest.mark.django_db


def _create_document(member, document_type='AADHAAR'):
    raw = b'private document bytes'
    return MemberDocument.objects.create(
        member=member,
        document_type=document_type,
        original_file_name='identity-proof.pdf',
        file_data=gzip.compress(raw),
        mime_type='application/pdf',
        file_size=len(raw),
        compressed_size=len(gzip.compress(raw)),
        status=MemberDocument.Status.PENDING,
    )


def _create_photo(member, *, checksum='a' * 64, display_order=0, is_primary=True):
    return ProfilePhoto.objects.create(
        user=member,
        image_data=b'private compressed image bytes',
        thumbnail_data=b'private thumbnail bytes',
        original_filename='portrait.jpg',
        original_size_bytes=1024,
        compressed_size_bytes=30,
        thumbnail_size_bytes=23,
        checksum=checksum,
        display_order=display_order,
        is_primary=is_primary,
        status=ProfilePhoto.Status.APPROVED,
    )


@override_settings(PERMANENT_DELETE_DOCUMENT_POLICY='delete_immediately')
def test_permanent_delete_cascades_photos_and_documents(
    authenticated_client,
    django_capture_on_commit_callbacks,
    member,
    super_admin,
):
    document = _create_document(member)
    photo = _create_photo(member)
    secondary_photo = _create_photo(
        member,
        checksum='b' * 64,
        display_order=1,
        is_primary=False,
    )
    member_id = member.pk
    photo_id = photo.pk
    secondary_photo_id = secondary_photo.pk
    cache.set(f'profile:{member_id}', {'stale': True})
    cache.set(f'member:{member_id}:profile', {'stale': True})

    with django_capture_on_commit_callbacks(execute=True):
        response = authenticated_client(super_admin).patch(
            f'/api/v1/admin/users/{member_id}/',
            {'action': 'permanent_delete'},
            format='json',
        )

    assert response.status_code == 200
    assert not Member.objects.filter(pk=member_id).exists()
    assert not ProfilePhoto.objects.filter(pk=photo_id).exists()
    assert not ProfilePhoto.objects.filter(pk=secondary_photo_id).exists()
    assert not MemberDocument.objects.filter(pk=document.pk).exists()
    assert cache.get(f'profile:{member_id}') is None
    assert cache.get(f'member:{member_id}:profile') is None

    photo_audit = ProfilePhotoAuditLog.objects.get(
        photo_id=photo_id,
        action=ProfilePhotoAuditLog.Action.DELETED,
    )
    assert photo_audit.member_id == member_id
    assert photo_audit.actor_id == super_admin.pk
    assert photo_audit.details == {
        'reason': 'permanent_member_deletion',
        'status': ProfilePhoto.Status.APPROVED,
        'is_primary': True,
    }
    assert ProfilePhotoAuditLog.objects.filter(
        photo_id=secondary_photo_id,
        action=ProfilePhotoAuditLog.Action.DELETED,
    ).count() == 1

    deletion_audit = SuperAdminActivityLog.objects.get(
        actor_id=super_admin.pk,
        action='MEMBER_PERMANENTLY_DELETED',
        target_id=str(member_id),
    )
    assert deletion_audit.old_data['profile_photo_count'] == 2
    assert deletion_audit.old_data['document_count'] == 1
    assert deletion_audit.old_data['document_retention_policy'] == 'delete_immediately'
    assert 'retained_document_metadata' not in deletion_audit.old_data


@override_settings(PERMANENT_DELETE_DOCUMENT_POLICY='retain_metadata')
def test_legal_retention_preserves_only_document_metadata(
    authenticated_client,
    django_capture_on_commit_callbacks,
    member,
    super_admin,
):
    document = _create_document(member)
    document_id = document.pk
    member_id = member.pk

    with django_capture_on_commit_callbacks(execute=True):
        response = authenticated_client(super_admin).patch(
            f'/api/v1/admin/users/{member_id}/',
            {'action': 'permanent_delete'},
            format='json',
        )

    assert response.status_code == 200
    assert not MemberDocument.objects.filter(pk=document_id).exists()

    deletion_audit = SuperAdminActivityLog.objects.get(
        actor_id=super_admin.pk,
        action='MEMBER_PERMANENTLY_DELETED',
        target_id=str(member_id),
    )
    retained = deletion_audit.old_data['retained_document_metadata']
    assert retained == [
        {
            'document_id': str(document_id),
            'document_type': 'AADHAAR',
            'status': MemberDocument.Status.PENDING,
            'uploaded_at': retained[0]['uploaded_at'],
            'reviewed_at': None,
            'reviewed_by_id': None,
        }
    ]
    assert 'file_data' not in retained[0]
    assert 'private document bytes' not in json.dumps(deletion_audit.old_data)


@override_settings(PERMANENT_DELETE_DOCUMENT_POLICY='delete_immediately')
def test_transaction_rollback_does_not_delete_documents(
    django_capture_on_commit_callbacks,
    member,
    super_admin,
):
    document = _create_document(member)
    member_id = member.pk

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match='force rollback'):
            with __import__('django.db').db.transaction.atomic():
                permanently_delete_member(member=member, actor=super_admin)
                raise RuntimeError('force rollback')

    assert callbacks == []
    assert Member.objects.filter(pk=member_id).exists()
    assert MemberDocument.objects.filter(pk=document.pk).exists()
