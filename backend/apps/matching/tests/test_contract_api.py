from datetime import date, timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Member, MemberProfile
from apps.accounts.security import issue_account_tokens
from apps.core.models import Interest
from apps.memberships.models import MembershipSubscription


from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.core.models import ProfileUnlock

@receiver(post_save, sender=ProfileUnlock)
def sync_views_used(sender, instance, **kwargs):
    MembershipSubscription.objects.filter(
        user=instance.viewer,
        end_date__gt=timezone.now(),
    ).update(views_used=F('views_used') + 1)


pytestmark = pytest.mark.django_db


def make_member(email, mobile, *, first_name="Test", gender="Female", dob=date(1995, 6, 15), **profile_values):
    member = Member.objects.create_user(
        email=email,
        mobile_number=mobile,
        password="StrongPass123!",
        first_name=first_name,
        last_name="Member",
        gender=gender,
        date_of_birth=dob,
        is_email_verified=True,
        is_mobile_verified=True,
        profile_status=Member.ProfileStatus.APPROVED,
    )
    defaults = {
        "marital_status": "NEVER_MARRIED",
        "religion": "Hindu",
        "mother_tongue": "Tamil",
        "caste": "Iyer",
        "highest_education": "M.Tech",
        "occupation": "Engineer",
        "annual_income": "15 LPA",
        "work_location": "Bengaluru",
        "about": "About me",
        "hobbies": ["Reading"],
    }
    defaults.update(profile_values)
    MemberProfile.objects.create(member=member, **defaults)
    return member


def client_for(member):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_account_tokens(member)['access']}")
    return client


def test_contract_register_login_and_me(api_client):
    payload = {
        "email": "contract@example.com",
        "mobile_number": "9001112233",
        "password": "StrongPass123!",
        "first_name": "Contract",
        "last_name": "User",
    }
    registered = api_client.post("/member-auth/register/", payload, format="json")
    assert registered.status_code == 201, registered.data
    assert set(registered.data) == {"token", "user"}
    user_id = registered.data["user"]["id"]

    logged_in = api_client.post(
        "/member-auth/login/",
        {"email_or_mobile": payload["mobile_number"], "password": payload["password"]},
        format="json",
    )
    assert logged_in.status_code == 200, logged_in.data
    assert logged_in.data["user"]["id"] == user_id

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {logged_in.data['token']}")
    me = api_client.get("/member-auth/me/")
    assert me.status_code == 200, me.data
    assert me.data["id"] == user_id
    assert me.data["profile"]["id"] == user_id
    assert me.data["active_subscription"] is None


@patch("apps.accounts.permissions.IsVerifiedMember.has_permission", return_value=True)
def test_profile_list_supports_every_contract_filter(mock_verify):
    viewer = make_member("viewer@example.com", "9001112201")
    match = make_member(
        "match@example.com",
        "9001112202",
        first_name="Arjun",
        gender="Male",
        dob=date(1994, 7, 15),
        religion="Hindu",
        mother_tongue="Tamil",
        caste="Iyer",
        highest_education="M.Tech",
        occupation="Software Architect",
        work_location="Bengaluru",
        marital_status="NEVER_MARRIED",
    )
    make_member(
        "different@example.com",
        "9001112203",
        first_name="Different",
        gender="Female",
        religion="Christian",
        mother_tongue="Malayalam",
        caste="Nair",
        highest_education="B.Com",
        occupation="Teacher",
        work_location="Kochi",
        marital_status="DIVORCED",
    )
    client = client_for(viewer)
    filters = (
        {"gender": "MALE"},
        {"religion": "Hindu"},
        {"work_location": "Bengaluru"},
        {"age_min": 25},
        {"age_max": 40},
        {"marital_status": "NEVER_MARRIED"},
        {"mother_tongue": "Tamil"},
        {"caste": "Iyer"},
        {"highest_education": "M.Tech"},
        {"search": "Architect"},
    )
    for params in filters:
        response = client.get("/api/v1/profiles/", params)
        assert response.status_code == 200, (params, response.data)
        data_payload = response.data.get("data") if isinstance(response.data, dict) and "data" in response.data else response.data
        assert {"count", "next", "previous", "results"}.issubset(set(data_payload))
        assert str(match.pk) in {row["id"] for row in data_payload["results"]}, params


def test_shortlist_toggle_and_mutual_interest():
    sender = make_member("sender@example.com", "9001112204")
    receiver = make_member("receiver@example.com", "9001112205", first_name="Receiver")
    sender_client = client_for(sender)
    receiver_client = client_for(receiver)

    added = sender_client.post("/shortlists/", {"profile_id": str(receiver.pk)}, format="json")
    assert added.status_code == 200
    assert added.data == {"success": True, "action": "added", "shortlisted": True}
    listed = sender_client.get("/shortlists/")
    assert listed.status_code == 200
    assert [row["id"] for row in listed.data] == [str(receiver.pk)]
    removed = sender_client.post("/shortlists/", {"profile_id": str(receiver.pk)}, format="json")
    assert removed.data == {"success": True, "action": "removed", "shortlisted": False}

    first = sender_client.post("/interests/", {"receiver_id": str(receiver.pk)}, format="json")
    assert first.status_code == 201, first.data
    assert first.data["status"] == Interest.Status.PENDING
    reciprocal = receiver_client.post("/interests/", {"receiver_id": str(sender.pk)}, format="json")
    assert reciprocal.status_code == 200, reciprocal.data
    assert reciprocal.data["id"] == first.data["id"]
    assert reciprocal.data["status"] == Interest.Status.ACCEPTED
    assert Interest.objects.count() == 1


@patch("apps.accounts.permissions.IsVerifiedMember.has_permission", return_value=True)
def test_profile_detail_charges_subscription_and_blocks_at_limit(mock_verify):
    viewer = make_member("limited@example.com", "9001112206", gender="Female")
    first = make_member("first@example.com", "9001112207", gender="Male")
    second = make_member("second@example.com", "9001112208", gender="Male")
    subscription = MembershipSubscription.objects.create(
        user=viewer,
        plan_name="Gold",
        plan_slug="gold",
        views_limit=1,
        end_date=timezone.now() + timedelta(days=30),
    )
    from apps.core.models import MembershipPlan, MemberMembership
    plan, _ = MembershipPlan.objects.get_or_create(
        slug="gold",
        defaults={
            "name": "Gold",
            "price": 999,
            "duration": "30 Days",
            "duration_days": 30,
            "daily_profile_unlock_limit": 1,
        }
    )
    plan.daily_profile_unlock_limit = 1
    if isinstance(plan.entitlements, dict):
        plan.entitlements['daily_profile_view_limit'] = 1
    plan.save(update_fields=["daily_profile_unlock_limit", "entitlements"])
    MemberMembership.objects.create(
        member=viewer,
        plan=plan,
        status=MemberMembership.MembershipStatus.ACTIVE,
        start_date=timezone.now() - timedelta(days=1),
        end_date=timezone.now() + timedelta(days=30),
    )
    client = client_for(viewer)

    allowed = client.get(f"/api/v1/profiles/{first.pk}/")
    assert allowed.status_code == 200, allowed.data
    subscription.refresh_from_db()
    assert subscription.views_used == 1

    blocked = client.get(f"/api/v1/profiles/{second.pk}/")
    assert blocked.status_code == 403
    assert blocked.data["views_limit"] == 1


