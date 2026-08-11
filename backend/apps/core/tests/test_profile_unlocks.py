import pytest
from django.utils import timezone
from apps.core.models import MembershipPlan, ProfileUnlock, ProfileBlock, Interest
from apps.accounts.models import Member
from rest_framework import status

pytestmark = pytest.mark.django_db

@pytest.fixture
def free_plan(db):
    plan, _ = MembershipPlan.objects.update_or_create(
        slug='free',
        defaults={
            'name': 'Free Plan',
            'price': 0.00,
            'duration': 'Lifetime',
            'features': ['Basic matchmaking'],
            'daily_profile_unlock_limit': 5,
            'messaging_mode': 'DISABLED',
            'is_active': True,
            'entitlements': {},
        }
    )
    return plan

@pytest.fixture
def gold_plan(db):
    plan, _ = MembershipPlan.objects.update_or_create(
        slug='gold',
        defaults={
            'name': 'Gold Plan',
            'price': 2999.00,
            'duration': '3 Months',
            'features': ['Messaging after mutual acceptance'],
            'daily_profile_unlock_limit': 50,
            'messaging_mode': 'MUTUAL_ONLY',
            'is_active': True,
            'entitlements': {},
        }
    )
    return plan

@pytest.fixture(autouse=True)
def mock_verification_checks():
    from unittest.mock import PropertyMock, patch
    with patch('apps.accounts.models.Member.are_verification_checks_passed', new_callable=PropertyMock, return_value=True):
        yield

@pytest.fixture
def female_member(db):
    member = Member.objects.create_user(
        email='female@example.com',
        mobile_number='9876543230',
        password='TestPassword!742',
        first_name='Anjali',
        last_name='Sharma',
        gender='female',
        is_email_verified=True,
    )
    member.profile_status = Member.ProfileStatus.APPROVED
    member.save()
    return member

@pytest.fixture
def male_member(db):
    member = Member.objects.create_user(
        email='male@example.com',
        mobile_number='9876543231',
        password='TestPassword!742',
        first_name='Rahul',
        last_name='Verma',
        gender='male',
        is_email_verified=True,
    )
    member.profile_status = Member.ProfileStatus.APPROVED
    member.save()
    return member

def test_opposite_gender_filtering(authenticated_client, male_member, female_member):
    # Rahul (male) logs in
    client = authenticated_client(male_member)
    response = client.get('/api/v1/profiles/')
    assert response.status_code == 200
    results = response.data['data']['results']
    # Should see only female member
    assert len(results) == 1
    assert results[0]['id'] == str(female_member.pk)

    # Anjali (female) logs in
    client = authenticated_client(female_member)
    response = client.get('/api/v1/profiles/')
    assert response.status_code == 200
    results = response.data['data']['results']
    # Should see only male member
    assert len(results) == 1
    assert results[0]['id'] == str(male_member.pk)

def test_free_profile_view_daily_limits(authenticated_client, male_member, free_plan):
    # Create 6 female members
    females = []
    for i in range(6):
        f = Member.objects.create_user(
            email=f'female{i}@example.com',
            mobile_number=f'987654324{i}',
            password='TestPassword!742',
            gender='female',
            is_email_verified=True
        )
        f.profile_status = Member.ProfileStatus.APPROVED
        f.save()
        females.append(f)

    client = authenticated_client(male_member)

    # First 5 views should succeed
    for i in range(5):
        response = client.get(f'/api/v1/profiles/{females[i].pk}/')
        assert response.status_code == 200
        assert response.data['data']['access']['profile_unlocked'] is True
        assert response.data['data']['access']['unlock_consumed'] is True
        assert response.data['data']['access']['unlocks_used_today'] == i + 1
        assert response.data['data']['access']['unlocks_remaining_today'] == 5 - (i + 1)

    # 6th view should fail with 403 daily limit reached
    response = client.get(f'/api/v1/profiles/{females[5].pk}/')
    assert response.status_code == 403
    assert response.data['code'] == 'daily_profile_unlock_limit_reached'
    assert response.data['used'] == 5
    assert response.data['remaining'] == 0

def test_repeated_view_same_day_no_limit_consumption(authenticated_client, male_member, female_member, free_plan):
    client = authenticated_client(male_member)

    # First view: consumes unlock
    response1 = client.get(f'/api/v1/profiles/{female_member.pk}/')
    assert response1.status_code == 200
    assert response1.data['data']['access']['unlock_consumed'] is True
    assert response1.data['data']['access']['unlocks_used_today'] == 1

    # Second view: does NOT consume unlock
    response2 = client.get(f'/api/v1/profiles/{female_member.pk}/')
    assert response2.status_code == 200
    assert response2.data['data']['access']['unlock_consumed'] is False
    assert response2.data['data']['access']['unlocks_used_today'] == 1

def test_free_messaging_permissions_blocked(authenticated_client, male_member, female_member, free_plan):
    client = authenticated_client(male_member)
    response = client.post(
        f'/api/v1/conversations/{female_member.pk}/messages/',
        {'text': 'Hello Anjali!'},
        format='json'
    )
    assert response.status_code == 403
    assert response.data['code'] == 'messaging_not_included'

def test_gold_messaging_permissions_requires_mutual_interest(authenticated_client, male_member, female_member, gold_plan):
    # Set male member's plan to Gold (is_premium = True)
    from apps.core.models import MemberMembership
    MemberMembership.objects.create(
        member=male_member,
        plan=gold_plan,
        is_active=True,
        status='ACTIVE'
    )
    male_member.is_premium = True
    male_member.save()

    client = authenticated_client(male_member)
    
    # Try sending message before interest
    response = client.post(
        f'/api/v1/conversations/{female_member.pk}/messages/',
        {'text': 'Hello Anjali!'},
        format='json'
    )
    assert response.status_code == 403
    assert response.data['code'] == 'messaging_requires_mutual_interest'

    # Create accepted interest
    interest = Interest.objects.create(
        sender=male_member,
        receiver=female_member,
        status=Interest.Status.ACCEPTED
    )

    # Try sending message after interest
    response2 = client.post(
        f'/api/v1/conversations/{female_member.pk}/messages/',
        {'text': 'Hello Anjali!'},
        format='json'
    )
    assert response2.status_code == 201
    assert response2.data['data']['text'] == 'Hello Anjali!'

def test_messaging_blocked_relationship(authenticated_client, male_member, female_member, gold_plan):
    # Set male member's plan to Gold (is_premium = True)
    from apps.core.models import MemberMembership
    MemberMembership.objects.create(
        member=male_member,
        plan=gold_plan,
        is_active=True,
        status='ACTIVE'
    )
    male_member.is_premium = True
    male_member.save()

    # Create accepted interest
    Interest.objects.create(
        sender=male_member,
        receiver=female_member,
        status=Interest.Status.ACCEPTED
    )

    # Create blocking relationship
    ProfileBlock.objects.create(
        blocker=female_member,
        blocked=male_member
    )

    client = authenticated_client(male_member)
    response = client.post(
        f'/api/v1/conversations/{female_member.pk}/messages/',
        {'text': 'Hello Anjali!'},
        format='json'
    )
    assert response.status_code == 403
    assert response.data['code'] == 'messaging_blocked'
