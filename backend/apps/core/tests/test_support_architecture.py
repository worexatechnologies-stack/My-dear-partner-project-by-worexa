import pytest

from apps.core.models import (
    Notification,
    SupportTicket,
    SupportTicketReply,
    TicketAssignment,
    TicketInternalNote,
    TicketStatusHistory,
)


pytestmark = pytest.mark.django_db


def create_member_ticket(client):
    response = client.post(
        '/api/v1/support/tickets/',
        {
            'category': 'GENERAL',
            'subject': 'I need help',
            'description': 'A concrete support question.',
            'priority': 'HIGH',
        },
        format='json',
    )
    assert response.status_code == 201, response.data
    return SupportTicket.objects.get(pk=response.data['data']['id'])


def assign_ticket(admin_client, ticket, support):
    response = admin_client.patch(
        f'/api/v1/admin/tickets/{ticket.pk}/',
        {'assigned_to': str(support.pk), 'assignment_reason': 'Payment queue'},
        format='json',
    )
    assert response.status_code == 200, response.data
    ticket.refresh_from_db()


def test_member_ticket_ownership_is_enforced(
    authenticated_client, member, other_member
):
    ticket = create_member_ticket(authenticated_client(member))
    assert authenticated_client(member).get(f'/api/v1/support/tickets/{ticket.pk}/').status_code == 200
    # Deliberately return 404 so one member cannot probe whether another member's ticket exists.
    assert authenticated_client(other_member).get(f'/api/v1/support/tickets/{ticket.pk}/').status_code == 404


def test_admin_assignment_creates_history_and_targets_only_the_agent(
    authenticated_client, member, admin_account, support_account, other_support
):
    ticket = create_member_ticket(authenticated_client(member))
    assign_ticket(authenticated_client(admin_account), ticket, support_account)
    assignment = TicketAssignment.objects.get(ticket=ticket, is_current=True)
    assert assignment.assigned_to_support_agent == support_account
    assert assignment.assigned_by_admin == admin_account
    assert ticket.status == SupportTicket.Status.ASSIGNED
    assert TicketStatusHistory.objects.filter(
        ticket=ticket,
        old_status=SupportTicket.Status.UNASSIGNED,
        new_status=SupportTicket.Status.ASSIGNED,
    ).exists()
    assert Notification.objects.filter(
        support_recipient=support_account,
        notification_type='TICKET_ASSIGNED',
    ).count() == 1
    assert not Notification.objects.filter(support_recipient=other_support).exists()


def test_support_can_only_open_its_assigned_tickets(
    authenticated_client, member, admin_account, support_account, other_support
):
    ticket = create_member_ticket(authenticated_client(member))
    assign_ticket(authenticated_client(admin_account), ticket, support_account)
    assert authenticated_client(support_account).get(
        f'/api/v1/customer-support/tickets/{ticket.pk}/'
    ).status_code == 200
    assert authenticated_client(other_support).get(
        f'/api/v1/customer-support/tickets/{ticket.pk}/'
    ).status_code == 404


def test_public_reply_is_visible_but_internal_note_never_reaches_member(
    authenticated_client, member, admin_account, support_account
):
    member_client = authenticated_client(member)
    ticket = create_member_ticket(member_client)
    assign_ticket(authenticated_client(admin_account), ticket, support_account)
    support_client = authenticated_client(support_account)
    reply = support_client.post(
        f'/api/v1/customer-support/tickets/{ticket.pk}/?action=reply',
        {'message': 'Here is the public answer.'},
        format='json',
    )
    assert reply.status_code == 201, reply.data
    note = support_client.post(
        f'/api/v1/customer-support/tickets/{ticket.pk}/?action=note',
        {'note': 'Private fraud-screening observation.'},
        format='json',
    )
    assert note.status_code == 201, note.data
    assert SupportTicketReply.objects.filter(ticket=ticket, support_sender=support_account).exists()
    assert TicketInternalNote.objects.filter(ticket=ticket, support_agent=support_account).exists()
    member_payload = member_client.get(f'/api/v1/support/tickets/{ticket.pk}/').data['data']
    assert [row['message'] for row in member_payload['replies']] == ['Here is the public answer.']
    assert 'internal_notes' not in member_payload
    assert 'fraud-screening' not in str(member_payload)


def test_support_status_change_is_historic_audited_and_member_targeted(
    authenticated_client, member, admin_account, support_account
):
    ticket = create_member_ticket(authenticated_client(member))
    assign_ticket(authenticated_client(admin_account), ticket, support_account)
    response = authenticated_client(support_account).post(
        f'/api/v1/customer-support/tickets/{ticket.pk}/?action=status',
        {'status': 'RESOLVED', 'reason': 'Member issue corrected'},
        format='json',
    )
    assert response.status_code == 200, response.data
    ticket.refresh_from_db()
    assert ticket.status == SupportTicket.Status.RESOLVED
    assert TicketStatusHistory.objects.filter(
        ticket=ticket,
        new_status=SupportTicket.Status.RESOLVED,
        changed_by_support=support_account,
    ).exists()
    assert Notification.objects.filter(
        member_recipient=member,
        notification_type='TICKET_RESOLVED',
    ).count() == 1


def test_member_can_reopen_own_resolved_ticket(
    authenticated_client, member, admin_account, support_account
):
    member_client = authenticated_client(member)
    ticket = create_member_ticket(member_client)
    assign_ticket(authenticated_client(admin_account), ticket, support_account)
    authenticated_client(support_account).post(
        f'/api/v1/customer-support/tickets/{ticket.pk}/?action=status',
        {'status': 'RESOLVED', 'reason': 'Initial resolution'},
        format='json',
    )
    response = member_client.post(
        f'/api/v1/support/tickets/{ticket.pk}/?action=reopen', {}, format='json'
    )
    assert response.status_code == 200, response.data
    ticket.refresh_from_db()
    assert ticket.status == SupportTicket.Status.REOPENED
    assert TicketStatusHistory.objects.filter(ticket=ticket, changed_by_member=member).exists()
