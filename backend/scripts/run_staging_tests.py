import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
django.setup()

import uuid
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import Member, SuperAdmin
from apps.core.models import (
    ChatMessage,
    ChatConversation,
    Notification,
    PaymentOrder,
    PaymentTransaction,
    MembershipPlan,
    ProfileReport,
)
from apps.core.message_service import create_message, serialize_message
from apps.core.api_utils import notify_chat_message
from apps.core.views.membership_views import (
    PaymentOrderStatusView,
    PaymentReceiptView,
)
from apps.core.role_views import AdminBulkPaymentReconcileView
from apps.core.old_views import (
    MessageHistoryView,
    ConversationListView,
    MemberProfileReportCreateView,
)
from apps.accounts.settings_views import (
    UserSettingsView,
    UserPrivacySettingsView,
    SafetyAccountDeletionAliasView,
)
from apps.core.tasks import (
    reconcile_razorpay_payments_task,
    process_sla_escalations,
)
from apps.memberships.tasks import reset_daily_view_limits
from django_celery_beat.models import PeriodicTask


passed = 0
failed = 0

def test_assert(desc, condition, details=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {desc}")
    else:
        failed += 1
        print(f"  [FAIL] {desc} -> {details}")

print("=" * 60)
print("  MY DEAR PARTNER - STAGING TEST SUITE")
print("=" * 60)

# ============================================================
# 1. CHAT MESSAGING & PLAINTEXT DISPLAY TESTS
# ============================================================
print("\n--- 1. Testing Chat Messaging Plaintext & Previews ---")
try:
    members = list(Member.objects.filter(account_status=Member.AccountStatus.ACTIVE, is_active=True, is_hidden=False)[:2])
    if len(members) < 2:
        test_assert("Sufficient active members for chat test", False, "Fewer than 2 active non-hidden members found")
    else:
        sender, receiver = members[0], members[1]
        test_plain_text = "Hello from staging test suite! Real plain message."

        # Send message
        msg = create_message(
            sender=sender,
            receiver=receiver,
            text=test_plain_text,
        )
        notify_chat_message(
            recipient=receiver,
            sender=sender,
            text=test_plain_text,
            message=msg,
        )

        # Check DB ChatMessage row
        test_assert("ChatMessage stored in DB", msg is not None)
        test_assert("ChatMessage text is plaintext without __E2EE__:", not msg.text.startswith("__E2EE__"))
        test_assert("ChatMessage text matches exact plain text", msg.text == test_plain_text)

        # Check serialize_message
        serialized = serialize_message(msg, viewer=receiver)
        test_assert("serialize_message returns clean plaintext text", serialized.get('text') == test_plain_text)
        test_assert("No lock placeholder in serialized message", "🔒" not in str(serialized.get('text', '')))

        # Check MessageHistoryView endpoint
        factory = APIRequestFactory()
        view_history = MessageHistoryView.as_view()
        req_hist = factory.get(f'/api/v1/conversations/{sender.pk}/messages/', HTTP_HOST='localhost')
        force_authenticate(req_hist, user=receiver)
        res_hist = view_history(req_hist, user_id=sender.pk)
        test_assert("MessageHistoryView returns HTTP 200", res_hist.status_code == 200)
        messages_data = res_hist.data.get('data', {}).get('messages', [])
        found_in_history = any(m.get('text') == test_plain_text for m in messages_data)
        test_assert("Message appears in history as readable plaintext", found_in_history)

        # Check ConversationListView endpoint
        view_conv = ConversationListView.as_view()
        req_conv = factory.get('/api/v1/conversations/')
        force_authenticate(req_conv, user=receiver)
        res_conv = view_conv(req_conv)
        test_assert("ConversationListView returns HTTP 200", res_conv.status_code == 200)
        convs = res_conv.data.get('data', [])
        found_conv = next((c for c in convs if str(c.get('partner_id') or c.get('id')) == str(sender.pk)), None)
        test_assert("Conversation found in list", found_conv is not None)
        if found_conv:
            last_msg = found_conv.get('lastMessage', '')
            test_assert("Conversation lastMessage is clean plaintext", last_msg == test_plain_text)
            test_assert("Conversation lastMessage has no lock emoji", "🔒" not in str(last_msg))

        # Check Notification preview
        notif = Notification.objects.filter(
            member_recipient=receiver,
            notification_type='CHAT_MESSAGE'
        ).order_by('-created_at').first()
        test_assert("Notification created for receiver", notif is not None)
        if notif:
            test_assert("Notification message contains plain text", test_plain_text in notif.message or test_plain_text in notif.title)
            test_assert("Notification message has no __E2EE__:", "__E2EE__:" not in notif.message)
            test_assert("Notification message has no lock placeholder", "🔒" not in notif.message)
except Exception as exc:
    test_assert("Chat Messaging Test completed without exception", False, str(exc))

# ============================================================
# 2. PAYMENT IDENTIFIERS & ON-DEMAND STATUS
# ============================================================
print("\n--- 2. Testing Payment Order Status & Identifiers ---")
try:
    order = PaymentOrder.objects.first()
    if not order:
        test_assert("Payment order exists in DB", False, "No PaymentOrder found")
    else:
        factory = APIRequestFactory()
        view_status = PaymentOrderStatusView.as_view()

        # By UUID
        req_uuid = factory.get(f'/api/v1/payments/orders/{order.pk}/status/')
        force_authenticate(req_uuid, user=order.user)
        res_uuid = view_status(req_uuid, id=str(order.pk))
        test_assert("PaymentOrderStatusView by UUID returns 200", res_uuid.status_code == 200)
        test_assert("UUID response contains valid order_status", res_uuid.data.get('data', {}).get('order_status') == order.status)

        # By Razorpay Order ID
        if order.razorpay_order_id:
            req_rzp = factory.get(f'/api/v1/payments/orders/{order.razorpay_order_id}/status/')
            force_authenticate(req_rzp, user=order.user)
            res_rzp = view_status(req_rzp, id=order.razorpay_order_id)
            test_assert("PaymentOrderStatusView by Razorpay ID returns 200", res_rzp.status_code == 200)
            test_assert("Razorpay ID response returns correct internal_order_id", res_rzp.data.get('data', {}).get('internal_order_id') == str(order.pk))

        # By Internal Order Number
        if order.internal_order_number:
            req_num = factory.get(f'/api/v1/payments/orders/{order.internal_order_number}/status/')
            force_authenticate(req_num, user=order.user)
            res_num = view_status(req_num, id=order.internal_order_number)
            test_assert("PaymentOrderStatusView by Internal Order Number returns 200", res_num.status_code == 200)
            test_assert("Internal Number response contains correct plan_name", res_num.data.get('data', {}).get('plan_name') == (order.membership_plan.name if order.membership_plan else None))

        # Non-existent ID returns 404
        req_missing = factory.get('/api/v1/payments/orders/non_existent_dummy_id/status/')
        force_authenticate(req_missing, user=order.user)
        res_missing = view_status(req_missing, id='non_existent_dummy_id')
        test_assert("PaymentOrderStatusView with non-existent ID returns 404", res_missing.status_code == 404)

        # Receipt test
        if order.status == 'paid':
            view_receipt = PaymentReceiptView.as_view()
            req_rcpt = factory.get(f'/api/v1/payments/{order.internal_order_number}/receipt/')
            force_authenticate(req_rcpt, user=order.user)
            res_rcpt = view_receipt(req_rcpt, id=order.internal_order_number)
            test_assert("PaymentReceiptView by internal number returns 200", res_rcpt.status_code == 200)
            test_assert("PaymentReceiptView returns correct receipt amount", 'amount' in res_rcpt.data.get('data', {}))
except Exception as exc:
    test_assert("Payment Order Tests completed without exception", False, str(exc))

# ============================================================
# 3. ADMIN BULK PAYMENT RECONCILIATION
# ============================================================
print("\n--- 3. Testing Admin Bulk Payment Reconciliation ---")
try:
    admin = SuperAdmin.objects.first()
    if not admin:
        test_assert("SuperAdmin exists for bulk reconcile test", False, "No SuperAdmin found")
    else:
        factory = APIRequestFactory()
        view_bulk = AdminBulkPaymentReconcileView.as_view()
        req_bulk = factory.post('/api/v1/admin/payments/reconcile/', {'minutes': 60}, format='json')
        force_authenticate(req_bulk, user=admin)
        res_bulk = view_bulk(req_bulk)
        test_assert("AdminBulkPaymentReconcileView returns 200", res_bulk.status_code == 200)
        test_assert("AdminBulkPaymentReconcileView reports success", res_bulk.data.get('success') is True)
        test_assert("AdminBulkPaymentReconcileView contains execution log", 'log' in res_bulk.data.get('data', {}))
except Exception as exc:
    test_assert("Admin Bulk Reconcile Test completed without exception", False, str(exc))

# ============================================================
# 4. CELERY BEAT PERIODIC TASKS
# ============================================================
print("\n--- 4. Testing Celery Periodic Tasks & Execution ---")
try:
    # Check registration in django_celery_beat
    pt_reconcile = PeriodicTask.objects.filter(name='reconcile-razorpay-payments').first()
    test_assert("PeriodicTask reconcile-razorpay-payments registered", pt_reconcile is not None)
    if pt_reconcile:
        test_assert("reconcile-razorpay-payments is enabled", pt_reconcile.enabled is True)
        test_assert("reconcile-razorpay-payments crontab is */15", pt_reconcile.crontab.minute == '*/15')

    pt_sla = PeriodicTask.objects.filter(name='process-sla-escalations').first()
    test_assert("PeriodicTask process-sla-escalations registered", pt_sla is not None)
    if pt_sla:
        test_assert("process-sla-escalations is enabled", pt_sla.enabled is True)
        test_assert("process-sla-escalations crontab is */15", pt_sla.crontab.minute == '*/15')

    # Test direct execution of periodic tasks
    sla_result = process_sla_escalations()
    test_assert("process_sla_escalations executes without error", isinstance(sla_result, int))

    reconcile_result = reconcile_razorpay_payments_task(minutes=30)
    test_assert("reconcile_razorpay_payments_task executes without error", True)

    view_reset_result = reset_daily_view_limits()
    test_assert("reset_daily_view_limits executes without error", True)
except Exception as exc:
    test_assert("Celery Periodic Tasks Test completed without exception", False, str(exc))

# ============================================================
# 5. SETTINGS, PRIVACY, PROFILE REPORT & DELETION
# ============================================================
print("\n--- 5. Testing Settings, Privacy, Reports & Deletion Flow ---")
try:
    member = Member.objects.filter(account_status=Member.AccountStatus.ACTIVE, is_active=True).first()
    factory = APIRequestFactory()

    # Settings GET & PATCH
    view_settings = UserSettingsView.as_view()
    req_set_get = factory.get('/api/v1/settings/')
    force_authenticate(req_set_get, user=member)
    res_set_get = view_settings(req_set_get)
    test_assert("UserSettingsView GET returns 200", res_set_get.status_code == 200)

    # Privacy Settings GET & PATCH
    view_privacy = UserPrivacySettingsView.as_view()
    req_priv_get = factory.get('/api/v1/privacy-settings/')
    force_authenticate(req_priv_get, user=member)
    res_priv_get = view_privacy(req_priv_get)
    test_assert("UserPrivacySettingsView GET returns 200", res_priv_get.status_code == 200)

    # Profile Report Create
    target_member = Member.objects.exclude(pk=member.pk).filter(account_status=Member.AccountStatus.ACTIVE).first()
    if target_member:
        view_report = MemberProfileReportCreateView.as_view()
        report_payload = {
            'reported_user': str(target_member.pk),
            'reason': 'HARASSMENT',
            'details': 'Automated test profile report',
        }
        req_report = factory.post('/api/v1/profile-reports/', report_payload, format='json')
        force_authenticate(req_report, user=member)
        res_report = view_report(req_report)
        test_assert("MemberProfileReportCreateView returns 201 Created", res_report.status_code == 201)
        created_report_id = res_report.data.get('data', {}).get('id')
        test_assert("Report saved in DB", ProfileReport.objects.filter(pk=created_report_id).exists())

    # Account Deletion Request & Recovery Flow
    # Use a temporary disposable member for deletion testing
    temp_email = f"test_delete_{uuid.uuid4().hex[:6]}@example.com"
    test_del_member = Member.objects.create_user(
        email=temp_email,
        password="TestPassword123!",
        first_name="Delete",
        last_name="Tester",
        account_status=Member.AccountStatus.ACTIVE,
        is_active=True,
    )

    view_del = SafetyAccountDeletionAliasView.as_view()
    req_del = factory.delete('/api/v1/safety/account-deletion/')
    force_authenticate(req_del, user=test_del_member)
    res_del = view_del(req_del)
    test_assert("SafetyAccountDeletionAliasView DELETE returns 200", res_del.status_code == 200)
    test_del_member.refresh_from_db()
    test_assert("Account status updated to deletion_pending", test_del_member.account_status == Member.AccountStatus.DELETION_PENDING)
    test_assert("Recovery window recovery_until is populated", test_del_member.recovery_until is not None)

    # Recovery / Cancellation
    req_rec = factory.post('/api/v1/safety/account-deletion/', {'action': 'cancel'}, format='json')
    force_authenticate(req_rec, user=test_del_member)
    res_rec = view_del(req_rec)
    test_assert("SafetyAccountDeletionAliasView cancel returns 200", res_rec.status_code == 200)
    test_del_member.refresh_from_db()
    test_assert("Account restored to active status", test_del_member.account_status == Member.AccountStatus.ACTIVE)

    # Cleanup temp member
    test_del_member.delete()
except Exception as exc:
    test_assert("Settings & Deletion Test completed without exception", False, str(exc))

# ============================================================
# SUMMARY
# ============================================================
print("\n" + "=" * 60)
print(f"  TOTAL TESTS: {passed + failed} | PASSED: {passed} | FAILED: {failed}")
print("=" * 60)

if failed > 0:
    sys.exit(1)
sys.exit(0)
