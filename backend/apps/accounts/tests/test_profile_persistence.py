"""Verification tests for profile persistence and Admin display.

Covers the cases required to confirm the profile data fix:
  1. Save min/max height -> persisted to PostgreSQL.
  2. PATCH response contains both saved values.
  3. Re-GET (simulated refresh) returns the same values.
  4. Fields remain populated after reload.
  5. Super Admin member detail returns the same values.
  6. (covered by 5) values appear in Admin/Super Admin view.
  7. Submit only one section (preferences) -> other sections untouched.
  8. (covered by 7) other fields not erased.
  9. Send an unknown field -> rejected.
 10. Unknown field returns HTTP 400, not a false 200.

Run with:
    DJANGO_SETTINGS_MODULE=config.settings.test \
        ./.venv/bin/python manage.py test apps.accounts.tests.test_profile_persistence
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import MemberPreference
from apps.accounts.security import issue_account_tokens

pytestmark = pytest.mark.django_db


def auth_client(account):
    client = APIClient()
    token = issue_account_tokens(account)['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


def test_save_height_min_max_persists_and_round_trips(member, super_admin):
    client = auth_client(member)

    # 1. Save minimum and maximum height.
    patch = client.patch(
        '/api/v1/member-auth/me/',
        {'pref_height_min': '160 cm', 'pref_height_max': '180 cm'},
        format='json',
    )
    assert patch.status_code == 200, patch.content

    # 2. PATCH response contains both saved values.
    data = patch.data['data']
    assert data['pref_height_min'] == '160 cm'
    assert data['pref_height_max'] == '180 cm'

    # Confirm they really landed in PostgreSQL.
    prefs = MemberPreference.objects.get(member=member)
    assert prefs.preferred_height_min == '160 cm'
    assert prefs.preferred_height_max == '180 cm'

    # 3 & 4. Refresh (re-GET) -> both fields still populated.
    refreshed = client.get('/api/v1/member-auth/me/')
    assert refreshed.status_code == 200
    assert refreshed.data['data']['pref_height_min'] == '160 cm'
    assert refreshed.data['data']['pref_height_max'] == '180 cm'

    # 5 & 6. Super Admin member detail returns the same values.
    admin_client = auth_client(super_admin)
    detail = admin_client.get(f'/api/v1/admin/users/{member.pk}/')
    assert detail.status_code == 200, detail.content
    assert detail.data['data']['member']['pref_height_min'] == '160 cm'
    assert detail.data['data']['member']['pref_height_max'] == '180 cm'


def test_partial_section_update_does_not_erase_other_sections(member):
    client = auth_client(member)

    # Seed a value in a different section (basic/about).
    client.patch('/api/v1/member-auth/me/', {'about': 'Original about text'}, format='json')
    assert MemberPreference.objects.get(member=member).preferred_religion == ''

    # 7 & 8. Submit ONLY the preferences section.
    patch = client.patch(
        '/api/v1/member-auth/me/',
        {'pref_religion': 'Hindu', 'pref_age_min': 25, 'pref_age_max': 35},
        format='json',
    )
    assert patch.status_code == 200, patch.content

    # Other-section value must survive.
    after = client.get('/api/v1/member-auth/me/').data['data']
    assert after['about'] == 'Original about text'
    prefs = MemberPreference.objects.get(member=member)
    assert prefs.preferred_religion == 'Hindu'


def test_canonical_field_names_are_accepted_and_persisted(member):
    client = auth_client(member)

    # The spec's canonical names must be accepted (aliased to model fields).
    patch = client.patch(
        '/api/v1/member-auth/me/',
        {
            'about_me': 'Canonical about',
            'current_city': 'Bangalore',
            'preferred_min_age': 24,
            'preferred_max_age': 36,
            'preferred_min_height': '150 cm',
            'preferred_max_height': '190 cm',
            'preferred_locations': 'Bangalore, Mumbai',
            'ideal_partner_description': 'Kind and caring',
        },
        format='json',
    )
    assert patch.status_code == 200, patch.content
    data = patch.data['data']
    assert data['about'] == 'Canonical about'
    assert data['work_location'] == 'Bangalore'
    assert data['pref_age_min'] == 24
    assert data['pref_age_max'] == 36
    assert data['pref_height_min'] == '150 cm'
    assert data['pref_height_max'] == '190 cm'
    assert data['pref_location'] == 'Bangalore, Mumbai'
    assert data['pref_about'] == 'Kind and caring'
    # Canonical names also echoed back in the response.
    assert data['about_me'] == 'Canonical about'
    assert data['current_city'] == 'Bangalore'


def test_unknown_profile_field_is_rejected_with_400(member, super_admin):
    client = auth_client(member)

    # 9 & 10. Send a genuinely unknown field -> 400, not a false 200.
    bad = client.patch(
        '/api/v1/member-auth/me/',
        {'not_a_real_field': 'should fail', 'bogus_payload': 'x'},
        format='json',
    )
    assert bad.status_code == 400, bad.content
    errors = bad.data
    error_keys = set(errors.keys()) if isinstance(errors, dict) else set()
    if 'errors' in error_keys and isinstance(errors['errors'], dict):
        error_keys = set(errors['errors'].keys())
    elif 'detail' in error_keys and isinstance(errors['detail'], dict):
        error_keys = set(errors['detail'].keys())
    # The offending keys must be reported so the client knows they were dropped.
    assert 'not_a_real_field' in error_keys or 'bogus_payload' in error_keys
