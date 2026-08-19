import hashlib

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Member
from apps.accounts.security import issue_account_tokens
from apps.core.models import Notification, WebPushSubscription


class NotificationCenterTests(TestCase):
    def setUp(self):
        self.member = Member.objects.create_user(
            email='member@example.com',
            mobile_number='9876543210',
            password='TestPassword!742',
            first_name='Maya',
            last_name='Member',
        )
        self.other_member = Member.objects.create_user(
            email='other@example.com',
            mobile_number='9876543211',
            password='TestPassword!742',
            first_name='Other',
            last_name='Member',
        )

    @staticmethod
    def payload(response):
        return response.data['data']

    @staticmethod
    def notification(member, *, title='Connection update', priority=Notification.Priority.NORMAL, is_read=False):
        return Notification.objects.create(
            member_recipient=member,
            notification_type='INTEREST_RECEIVED',
            title=title,
            message='A member would like to connect.',
            link_url='/interests',
            priority=priority,
            is_read=is_read,
        )

    @staticmethod
    def authenticated_client(member):
        client = APIClient()
        token = issue_account_tokens(member)['access']
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return client

    def test_member_notification_feed_is_private_and_cursor_paginated(self):
        own_notifications = [self.notification(self.member, title=f'Update {index}') for index in range(21)]
        foreign_notification = self.notification(self.other_member, title='Private update')

        first_response = self.authenticated_client(self.member).get('/api/v1/notifications/', {'limit': 20})

        self.assertEqual(first_response.status_code, 200, first_response.data)
        first_page = self.payload(first_response)
        self.assertEqual(len(first_page['results']), 20)
        self.assertTrue(first_page['next_cursor'])
        self.assertTrue(first_page['has_more'])
        first_ids = {row['id'] for row in first_page['results']}
        self.assertNotIn(str(foreign_notification.pk), first_ids)

        second_response = self.authenticated_client(self.member).get(
            '/api/v1/notifications/',
            {'limit': 20, 'cursor': first_page['next_cursor']},
        )

        self.assertEqual(second_response.status_code, 200, second_response.data)
        second_page = self.payload(second_response)
        self.assertEqual(len(second_page['results']), 1)
        self.assertIsNone(second_page['next_cursor'])
        returned_ids = first_ids | {row['id'] for row in second_page['results']}
        self.assertSetEqual(returned_ids, {str(notification.pk) for notification in own_notifications})

    def test_member_can_mark_own_notification_read_but_not_another_members(self):
        own_notification = self.notification(self.member)
        foreign_notification = self.notification(self.other_member)
        client = self.authenticated_client(self.member)

        response = client.patch(f'/api/v1/notifications/{own_notification.pk}/read/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(self.payload(response)['is_read'])
        self.assertEqual(self.payload(response)['unread_count'], 0)
        own_notification.refresh_from_db()
        self.assertTrue(own_notification.is_read)
        self.assertIsNotNone(own_notification.read_at)

        forbidden = client.patch(f'/api/v1/notifications/{foreign_notification.pk}/read/')
        self.assertEqual(forbidden.status_code, 404)
        foreign_notification.refresh_from_db()
        self.assertFalse(foreign_notification.is_read)

    def test_clear_notifications_hides_only_the_requesting_member_feed(self):
        unread = self.notification(self.member, title='Unread')
        read = self.notification(self.member, title='Read', is_read=True)
        foreign_notification = self.notification(self.other_member, title='Other member')
        client = self.authenticated_client(self.member)

        response = client.post('/api/v1/notifications/clear/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.payload(response)['cleared_count'], 2)
        self.assertEqual(self.payload(response)['unread_count'], 0)

        unread.refresh_from_db()
        read.refresh_from_db()
        foreign_notification.refresh_from_db()
        self.assertIsNotNone(unread.cleared_at)
        self.assertTrue(unread.is_read)
        self.assertIsNotNone(read.cleared_at)
        self.assertIsNone(foreign_notification.cleared_at)

        feed = client.get('/api/v1/notifications/')
        unread_count = client.get('/api/v1/notifications/unread-count/')
        self.assertEqual(feed.status_code, 200, feed.data)
        self.assertEqual(self.payload(feed)['results'], [])
        self.assertEqual(self.payload(unread_count)['unread_count'], 0)

    @override_settings(
        WEB_PUSH_VAPID_PUBLIC_KEY='test-public-key',
        WEB_PUSH_VAPID_PRIVATE_KEY='test-private-key',
    )
    def test_browser_push_subscription_is_owned_by_the_authenticated_member(self):
        endpoint = 'https://push.example.test/subscriptions/member-device'
        client = self.authenticated_client(self.member)

        subscribed = client.post(
            '/api/v1/notifications/push/subscriptions/',
            {'endpoint': endpoint, 'p256dh': 'p256dh-key', 'auth': 'auth-key'},
            format='json',
        )

        self.assertEqual(subscribed.status_code, 200, subscribed.data)
        self.assertEqual(self.payload(subscribed), {'enabled': True, 'subscribed': True})
        endpoint_hash = hashlib.sha256(endpoint.encode('utf-8')).hexdigest()
        subscription = WebPushSubscription.objects.get(endpoint_hash=endpoint_hash)
        self.assertEqual(subscription.member_id, self.member.pk)
        self.assertTrue(subscription.is_active)

        removal = self.authenticated_client(self.other_member).delete(
            '/api/v1/notifications/push/subscriptions/',
            {'endpoint': endpoint},
            format='json',
        )

        self.assertEqual(removal.status_code, 200, removal.data)
        subscription.refresh_from_db()
        self.assertTrue(subscription.is_active)

    def test_notification_filters_validate_and_return_high_priority_only(self):
        normal = self.notification(self.member, title='Normal')
        important = self.notification(self.member, title='Important', priority=Notification.Priority.HIGH)
        client = self.authenticated_client(self.member)

        response = client.get('/api/v1/notifications/', {'filter': 'important'})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row['id'] for row in self.payload(response)['results']], [str(important.pk)])
        self.assertNotIn(str(normal.pk), {row['id'] for row in self.payload(response)['results']})

        invalid = client.get('/api/v1/notifications/', {'filter': 'anything-else'})
        self.assertEqual(invalid.status_code, 400)
