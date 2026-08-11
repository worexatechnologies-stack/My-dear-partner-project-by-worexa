import pytest
from apps.accounts.models import Country, State, City, Branch, AdminAccessScope, StaffAccessScope, Member, SuperAdmin
from apps.core.models import ProfileVerificationRequest, SupportTicket, SupportCategory


pytestmark = pytest.mark.django_db


@pytest.fixture
def locations(db):
    country = Country.objects.create(code='IN', name='India')
    state = State.objects.create(country=country, code='KA', name='Karnataka')
    city = City.objects.create(state=state, code='BLR', name='Bangalore')
    branch_a = Branch.objects.create(city=city, code='BLR-JP', name='JP Nagar Branch')
    branch_b = Branch.objects.create(city=city, code='BLR-IN', name='Indiranagar Branch')
    return {
        'country': country,
        'state': state,
        'city': city,
        'branch_a': branch_a,
        'branch_b': branch_b
    }


def test_super_admin_bypasses_scope(authenticated_client, super_admin, member, locations):
    # Member belongs to Branch B
    member.branch = locations['branch_b']
    member.save()
    
    # Create verification request
    verification = ProfileVerificationRequest.objects.create(
        member=member,
        verification_type='FULL_PROFILE'
    )
    
    # Super Admin should view list with the verification
    response = authenticated_client(super_admin).get('/api/v1/admin/verifications/')
    assert response.status_code == 200
    assert any(str(v['id']) == str(verification.pk) for v in response.data['data']['results'])
    
    # Super Admin can view detail page directly
    response = authenticated_client(super_admin).get(f'/api/v1/admin/verifications/{verification.pk}/')
    assert response.status_code == 200


def test_admin_restricted_by_scope(authenticated_client, admin_account, member, other_member, locations):
    # Assign member to Branch A
    member.branch = locations['branch_a']
    member.save()
    
    # Assign other member to Branch B
    other_member.branch = locations['branch_b']
    other_member.save()
    
    # Admin is scoped ONLY to Branch A
    AdminAccessScope.objects.create(
        account=admin_account,
        branch=locations['branch_a'],
        permission_scope_type='BRANCH',
        is_active=True
    )
    
    # 1. Verification Request for Member in Branch A
    verification_a = ProfileVerificationRequest.objects.create(
        member=member,
        verification_type='FULL_PROFILE'
    )
    
    # 2. Verification Request for Member in Branch B
    verification_b = ProfileVerificationRequest.objects.create(
        member=other_member,
        verification_type='FULL_PROFILE'
    )
    
    # Admin lists verifications - should only see verification_a
    response = authenticated_client(admin_account).get('/api/v1/admin/verifications/')
    assert response.status_code == 200
    results = response.data['data']['results']
    assert any(str(v['id']) == str(verification_a.pk) for v in results)
    assert not any(str(v['id']) == str(verification_b.pk) for v in results)
    
    # Admin requests verification_a detail - OK
    response = authenticated_client(admin_account).get(f'/api/v1/admin/verifications/{verification_a.pk}/')
    assert response.status_code == 200
    
    # Admin requests verification_b detail - FORBIDDEN (403)
    response = authenticated_client(admin_account).get(f'/api/v1/admin/verifications/{verification_b.pk}/')
    assert response.status_code == 403


def test_cannot_delete_final_super_admin(authenticated_client, super_admin):
    # Ensure there is exactly 1 Super Admin
    assert SuperAdmin.objects.filter(deleted_at__isnull=True).count() == 1
    
    # Try to delete own account (not allowed)
    response = authenticated_client(super_admin).delete(f'/api/v1/super-admin/accounts/super_admin/{super_admin.pk}/')
    assert response.status_code == 400
