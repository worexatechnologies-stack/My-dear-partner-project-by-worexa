import pytest

from apps.core.models import Interest


pytestmark = pytest.mark.django_db


def test_receiver_can_decline_an_accepted_interest(authenticated_client, member, other_member):
    interest = Interest.objects.create(
        sender=other_member,
        receiver=member,
        status=Interest.Status.ACCEPTED,
    )

    response = authenticated_client(member).patch(
        f'/api/v1/interests/{interest.pk}/',
        {'status': Interest.Status.DECLINED},
        format='json',
    )

    assert response.status_code == 200, response.data
    interest.refresh_from_db()
    assert interest.status == Interest.Status.DECLINED
