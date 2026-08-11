import pytest
import datetime
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import Member, MemberProfile, MemberPreference
from apps.accounts.serializers import MemberRegistrationSerializer

pytestmark = pytest.mark.django_db

def test_signup_validation_success(api_client):
    payload = {
        'first_name': 'Ullas',
        'last_name': 'Matrimony',
        'email': 'ullas.new@company.in',
        'mobile_number': '+91 98765-43210',
        'date_of_birth': '1998-05-15',
        'gender': 'Male',
        'password': 'StrongPassword123!',
        'confirm_password': 'StrongPassword123!',
        'accept_terms': True,
        'profile_created_by': 'Self',
    }
    response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response.status_code == 201
    data = response.data['data']
    assert 'access' in data
    assert 'refresh' in data
    assert data['user']['email'] == 'ullas.new@company.in'
    assert data['user']['mobile_number'] == '9876543210'

def test_signup_validation_duplicate_email_and_mobile(api_client, member):
    payload = {
        'first_name': 'Ullas',
        'last_name': 'Duplicate',
        'email': member.email,  # duplicate email
        'mobile_number': '+919999999999',
        'date_of_birth': '1995-10-10',
        'gender': 'Male',
        'password': 'StrongPassword123!',
        'confirm_password': 'StrongPassword123!',
        'accept_terms': True,
    }
    response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response.status_code == 400
    assert 'email' in response.data['errors']

    payload['email'] = 'new_unique_email@example.com'
    payload['mobile_number'] = member.mobile_number  # duplicate mobile
    response2 = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response2.status_code == 400
    assert 'mobile_number' in response2.data['errors']

def test_signup_validation_name_rules(api_client):
    payload = {
        'first_name': 'A',  # too short
        'last_name': 'ValidName',
        'email': 'test@example.com',
        'mobile_number': '9876543210',
        'date_of_birth': '1995-10-10',
        'gender': 'Male',
        'password': 'StrongPassword123!',
        'confirm_password': 'StrongPassword123!',
        'accept_terms': True,
    }
    response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response.status_code == 400
    assert 'first_name' in response.data['errors']

    # Number-only name
    payload['first_name'] = '12345'
    response2 = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response2.status_code == 400
    assert 'first_name' in response2.data['errors']

    # Special characters not allowed
    payload['first_name'] = 'First#Name'
    response3 = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response3.status_code == 400
    assert 'first_name' in response3.data['errors']

def test_signup_validation_email_formatting(api_client):
    invalid_emails = [
        'ullas',
        'ullas@',
        'ullas@gmail',
        'ullas gmail.com',
        '@gmail.com',
        'ullas space@gmail.com'
    ]
    for email in invalid_emails:
        payload = {
            'first_name': 'Ullas',
            'last_name': 'ValidName',
            'email': email,
            'mobile_number': '9876543210',
            'date_of_birth': '1995-10-10',
            'gender': 'Male',
            'password': 'StrongPassword123!',
            'confirm_password': 'StrongPassword123!',
            'accept_terms': True,
        }
        response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
        assert response.status_code == 400
        assert 'email' in response.data['errors']

def test_signup_validation_mobile_formatting(api_client):
    invalid_mobiles = [
        '123456789',      # too short
        '12345678901',    # too long
        'abcdefghij',      # letters
        '0000000000',      # repeated zeros
        '9999999999',      # repeated nines
        '5876543210',      # starts with 5 (not Indian 6-9)
    ]
    for mobile in invalid_mobiles:
        payload = {
            'first_name': 'Ullas',
            'last_name': 'ValidName',
            'email': 'unique@example.com',
            'mobile_number': mobile,
            'date_of_birth': '1995-10-10',
            'gender': 'Male',
            'password': 'StrongPassword123!',
            'confirm_password': 'StrongPassword123!',
            'accept_terms': True,
        }
        response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
        assert response.status_code == 400
        assert 'mobile_number' in response.data['errors']

def test_signup_validation_age_checks(api_client):
    # Under 18 years
    today = timezone.localdate()
    under_18_dob = today - datetime.timedelta(days=17*365)
    payload = {
        'first_name': 'Ullas',
        'last_name': 'ValidName',
        'email': 'under18@example.com',
        'mobile_number': '9876543210',
        'date_of_birth': under_18_dob.isoformat(),
        'gender': 'Male',
        'password': 'StrongPassword123!',
        'confirm_password': 'StrongPassword123!',
        'accept_terms': True,
    }
    response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response.status_code == 400
    assert 'date_of_birth' in response.data['errors']

    # Future date
    future_dob = today + datetime.timedelta(days=1)
    payload['date_of_birth'] = future_dob.isoformat()
    response2 = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response2.status_code == 400
    assert 'date_of_birth' in response2.data['errors']

def test_signup_validation_password_checklist(api_client):
    passwords = [
        ('short', 'Password must contain at least 8 characters.'),
        ('noupper123!', 'Password must contain at least one uppercase letter.'),
        ('NOLOWER123!', 'Password must contain at least one lowercase letter.'),
        ('NoNumber!', 'Password must contain at least one number.'),
        ('NoSpecial123', 'Password must contain at least one special character.'),
        ('test@example.com123!', 'Password must not contain your email address or mobile number.'),
        ('9876543210123!', 'Password must not contain your email address or mobile number.'),
    ]
    for pwd, expected_msg in passwords:
        payload = {
            'first_name': 'Ullas',
            'last_name': 'ValidName',
            'email': 'test@example.com',
            'mobile_number': '9876543210',
            'date_of_birth': '1995-10-10',
            'gender': 'Male',
            'password': pwd,
            'confirm_password': pwd,
            'accept_terms': True,
        }
        response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
        assert response.status_code == 400
        assert 'password' in response.data['errors']
        assert any(expected_msg in err for err in response.data['errors']['password'])

def test_signup_validation_password_confirm_mismatch(api_client):
    payload = {
        'first_name': 'Ullas',
        'last_name': 'ValidName',
        'email': 'mismatch@example.com',
        'mobile_number': '9876543210',
        'date_of_birth': '1995-10-10',
        'gender': 'Male',
        'password': 'StrongPassword123!',
        'confirm_password': 'DifferentPassword123!',
        'accept_terms': True,
    }
    response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response.status_code == 400
    assert 'confirm_password' in response.data['errors']
    assert 'Passwords do not match.' in response.data['errors']['confirm_password']

def test_signup_validation_accept_terms_required(api_client):
    payload = {
        'first_name': 'Ullas',
        'last_name': 'ValidName',
        'email': 'noterms@example.com',
        'mobile_number': '9876543210',
        'date_of_birth': '1995-10-10',
        'gender': 'Male',
        'password': 'StrongPassword123!',
        'confirm_password': 'StrongPassword123!',
        'accept_terms': False,
    }
    response = api_client.post('/api/v1/member-auth/register/', payload, format='json')
    assert response.status_code == 400
    assert 'accept_terms' in response.data['errors']

def test_signup_transaction_rollback_on_failed_profile():
    from django.db import IntegrityError
    
    with pytest.raises(Exception):
        with transaction.atomic():
            Member.objects.create_user(
                email='rollback@example.com',
                password='StrongPassword123!',
                mobile_number='9876543210',
                first_name='Rollback',
                last_name='Test',
                gender='Male',
                date_of_birth=datetime.date(1995, 10, 10)
            )
            raise IntegrityError("Failed profile creation")

    assert not Member.objects.filter(email='rollback@example.com').exists()
