from dataclasses import dataclass
import gzip
import logging

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from .models import Member, MemberDocument, MemberPreference, MemberProfile


logger = logging.getLogger(__name__)

DELETE_DOCUMENTS_IMMEDIATELY = 'delete_immediately'
RETAIN_DOCUMENT_METADATA = 'retain_metadata'
SUPPORTED_PERMANENT_DELETE_DOCUMENT_POLICIES = {
    DELETE_DOCUMENTS_IMMEDIATELY,
    RETAIN_DOCUMENT_METADATA,
}


@dataclass(frozen=True)
class PermanentMemberDeletionResult:
    member_id: object
    photo_count: int
    document_count: int
    document_policy: str
    retained_document_metadata: tuple[dict, ...]

    def audit_context(self) -> dict:
        context = {
            'profile_photo_count': self.photo_count,
            'document_count': self.document_count,
            'document_retention_policy': self.document_policy,
        }
        if self.retained_document_metadata:
            context['retained_document_metadata'] = list(self.retained_document_metadata)
        return context


PROFILE_FIELDS = {
    'marital_status', 'height', 'weight', 'blood_group', 'complexion', 'religion',
    'mother_tongue', 'caste', 'sub_caste', 'gothra', 'star_nakshatra',
    'manglik_status', 'highest_education', 'education_detail', 'occupation',
    'employed_in', 'company', 'annual_income', 'work_location', 'father_status',
    'mother_status', 'num_brothers', 'num_sisters', 'family_type', 'family_status',
    'family_location', 'about', 'hobbies', 'compatibility',
}

PREFERENCE_ALIASES = {
    'pref_age_min': 'preferred_age_min',
    'pref_age_max': 'preferred_age_max',
    'pref_height_min': 'preferred_height_min',
    'pref_height_max': 'preferred_height_max',
    'pref_religion': 'preferred_religion',
    'pref_caste': 'preferred_caste',
    'pref_location': 'preferred_location',
    'pref_education': 'preferred_education',
    'pref_occupation': 'preferred_occupation',
    'pref_marital_status': 'preferred_marital_status',
    'pref_about': 'additional_expectations',
}


def _split_profile_data(data):
    profile_data = {key: data.pop(key) for key in list(data) if key in PROFILE_FIELDS}
    preference_data = {}
    for old_name, new_name in PREFERENCE_ALIASES.items():
        if old_name in data:
            preference_data[new_name] = data.pop(old_name)
    for field in set(PREFERENCE_ALIASES.values()):
        if field in data:
            preference_data[field] = data.pop(field)
    return profile_data, preference_data


@transaction.atomic
def create_member(email, password, **data):
    profile_data, preference_data = _split_profile_data(data)
    member_fields = {
        key: data.pop(key)
        for key in list(data)
        if key in {
            'mobile_number', 'first_name', 'last_name', 'gender', 'date_of_birth',
            'profile_created_by', 'is_active', 'is_premium', 'is_seed_data',
            'profile_status', 'photo_status', 'document_status',
        }
    }
    member = Member.objects.create_user(email=email, password=password, **member_fields)
    MemberProfile.objects.create(member=member, **profile_data)
    MemberPreference.objects.create(member=member, **preference_data)
    return member


@transaction.atomic
def update_member(member, **data):
    profile_data, preference_data = _split_profile_data(data)
    for field in ('first_name', 'last_name', 'mobile_number', 'gender', 'date_of_birth', 'profile_created_by', 'chat_public_key'):
        if field in data:
            setattr(member, field, data[field])
    member.save()

    profile, _ = MemberProfile.objects.get_or_create(member=member)
    for field, value in profile_data.items():
        setattr(profile, field, value)
    profile.save()

    preference, _ = MemberPreference.objects.get_or_create(member=member)
    for field, value in preference_data.items():
        setattr(preference, field, value)
    preference.save()
    return member


def dummy_sms_sender(*args, **kwargs):
    return None


def _isoformat(value):
    return value.isoformat() if value else None


def _document_audit_metadata(document: MemberDocument) -> dict:
    """Return legal-retention metadata with no path, filename, or file bytes."""

    return {
        'document_id': str(document.pk),
        'document_type': document.document_type,
        'status': document.status,
        'uploaded_at': _isoformat(document.uploaded_at),
        'reviewed_at': _isoformat(document.reviewed_at),
        'reviewed_by_id': str(document.reviewed_by_id) if document.reviewed_by_id else None,
    }


def _invalidate_deleted_member_profile_caches(member_id) -> None:
    try:
        cache.delete_many(
            (
                f'profile:{member_id}',
                f'member:{member_id}:profile',
            )
        )
    except Exception:  # pragma: no cover - deletion must survive a cache outage.
        logger.exception('Could not invalidate profile caches for deleted member %s', member_id)


@transaction.atomic
def permanently_delete_member(*, member: Member, actor=None) -> PermanentMemberDeletionResult:
    """Permanently delete a member while erasing all stored image binaries.

    Profile photo audit rows are deliberately inserted before cascade deletion.
    Document storage deletion and cache invalidation happen only after the
    surrounding transaction commits, so a database rollback cannot erase files.
    """

    from apps.profiles.models import ProfilePhoto, ProfilePhotoAuditLog

    member_id = member.pk
    document_policy = getattr(
        settings,
        'PERMANENT_DELETE_DOCUMENT_POLICY',
        DELETE_DOCUMENTS_IMMEDIATELY,
    )
    if document_policy not in SUPPORTED_PERMANENT_DELETE_DOCUMENT_POLICIES:
        raise ValueError(f'Unsupported permanent-delete document policy: {document_policy}')

    photos = list(
        ProfilePhoto.objects.select_for_update()
        .filter(user_id=member_id)
        .values(
            'id',
            'status',
            'is_primary',
        )
    )
    audit_time = timezone.now()
    ProfilePhotoAuditLog.objects.bulk_create(
        [
            ProfilePhotoAuditLog(
                photo_id=photo['id'],
                member_id=member_id,
                actor_id=getattr(actor, 'pk', None),
                actor_type=str(getattr(actor, 'account_type', '')),
                action=ProfilePhotoAuditLog.Action.DELETED,
                details={
                    'reason': 'permanent_member_deletion',
                    'status': photo['status'],
                    'is_primary': photo['is_primary'],
                },
                created_at=audit_time,
            )
            for photo in photos
        ]
    )

    documents = list(
        MemberDocument.objects.select_for_update()
        .filter(member_id=member_id)
        .only(
            'id',
            'document_type',
            'file_data',
            'status',
            'uploaded_at',
            'reviewed_at',
            'reviewed_by_id',
        )
    )

    retained_metadata = ()
    if document_policy == RETAIN_DOCUMENT_METADATA:
        retained_metadata = tuple(_document_audit_metadata(document) for document in documents)

    # Remove verification links that protect documents from deletion.
    from apps.core.models import ProfileVerificationDocument
    ProfileVerificationDocument.objects.filter(member_document__member_id=member_id).delete()

    transaction.on_commit(lambda: _invalidate_deleted_member_profile_caches(member_id))
    member.delete()

    return PermanentMemberDeletionResult(
        member_id=member_id,
        photo_count=len(photos),
        document_count=len(documents),
        document_policy=document_policy,
        retained_document_metadata=retained_metadata,
    )


# Compatibility names for older internal imports.
create_user_profile = create_member
update_user_profile = update_member


def compress_document(file_data: bytes) -> bytes:
    return gzip.compress(file_data)


def decompress_document(compressed_data: bytes) -> bytes:
    return gzip.decompress(compressed_data)
