from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.models import MembershipPlan, MemberMembership, NotificationDeliveryLog, SupportExpiringMembership
from apps.accounts.models import Member


class MembershipLifecycleError(Exception):
    pass


class MembershipLifecycleService:
    """
    Membership lifecycle business logic:
    - Plan ranking and upgrade validation
    - Duplicate/prevent-downgrade protection
    - Expiry processing & milestone notifications
    - Free plan activation
    """

    RANK_MAP = {'free': 1, 'gold': 2, 'elite': 3, 'platinum': 4}

    # ── Ranking ──────────────────────────────────────────────

    @classmethod
    def get_plan_rank(cls, plan_slug: str) -> int:
        # Super Admin can reorder plans. Prefer the database rank so the
        # checkout and displayed plan card use the same tier ordering.
        plan = MembershipPlan.objects.filter(slug__iexact=plan_slug).only('rank').first()
        if plan and plan.rank not in (None, 99):
            return plan.rank
        return cls.RANK_MAP.get(str(plan_slug).lower(), 99)

    @classmethod
    def get_sorted_plans(cls):
        return MembershipPlan.objects.filter(is_active=True).order_by('rank', 'display_order')

    # ── Upgrade validation ───────────────────────────────────

    @classmethod
    def is_valid_upgrade(cls, current_plan_slug: str, target_plan_slug: str) -> bool:
        """
        Strict upgrade-only rule: Users can ONLY buy higher tier plans.
        No downgrades allowed, including to free plan.
        """
        current_rank = cls.get_plan_rank(current_plan_slug)
        target_rank = cls.get_plan_rank(target_plan_slug)
        
        # Only allow upgrades to higher tier plans - strict rule
        return target_rank > current_rank

    @classmethod
    def is_same_or_lower(cls, current_plan_slug: str, target_plan_slug: str) -> bool:
        current_rank = cls.get_plan_rank(current_plan_slug)
        target_rank = cls.get_plan_rank(target_plan_slug)
        return target_rank <= current_rank

    # ── User-facing helpers ──────────────────────────────────

    @classmethod
    def get_current_plan_slug(cls, member) -> str | None:
        from apps.core.services.membership_service import MembershipService
        plan = MembershipService.get_effective_plan(member)
        return plan.slug if plan else 'free'

    @classmethod
    def calculate_prorated_credit(cls, member) -> float:
        """Calculate remaining monetary value (credit) of user's active paid membership."""
        from apps.core.models import MemberMembership, MembershipPurchase
        
        active_mem = MemberMembership.objects.filter(
            member=member, is_active=True,
            status__in=[MemberMembership.MembershipStatus.ACTIVE, MemberMembership.MembershipStatus.EXPIRING_SOON],
        ).exclude(plan__slug='free').select_related('plan').first()
        
        if not active_mem or not active_mem.expires_at:
            return 0.0
            
        now = timezone.now()
        if active_mem.expires_at <= now:
            return 0.0

        from apps.core.models import PaymentOrder
        
        active_purchase = MembershipPurchase.objects.filter(
            user=member, status='active', price_snapshot__gt=0,
        ).order_by('-created_at').first()

        paid_order = PaymentOrder.objects.filter(
            user=member, status='paid',
        ).order_by('-created_at').first()

        if active_purchase and float(active_purchase.price_snapshot) > 0:
            plan_price = float(active_purchase.price_snapshot)
            total_days = active_purchase.duration_days_snapshot or 30
        elif paid_order and float(paid_order.amount) > 0:
            plan_price = float(paid_order.amount)
            total_days = paid_order.duration_days_snapshot or 30
        elif active_mem.plan and float(active_mem.plan.price) > 0:
            plan_price = float(active_mem.plan.price)
            total_days = active_mem.plan.duration_days or 30
        else:
            return 0.0

        if active_mem.started_at and active_mem.expires_at:
            span_days = (active_mem.expires_at - active_mem.started_at).days
            if span_days > 0:
                total_days = span_days

        remaining_seconds = (active_mem.expires_at - now).total_seconds()
        remaining_days = max(0.0, remaining_seconds / 86400.0)
        
        if plan_price <= 0 or total_days <= 0:
            return 0.0
            
        daily_rate = plan_price / float(total_days)
        unused_credit = round(daily_rate * remaining_days, 2)
        return min(unused_credit, plan_price)

    @classmethod
    def get_available_upgrades(cls, member) -> list[dict]:
        current_slug = cls.get_current_plan_slug(member)
        current_rank = cls.get_plan_rank(current_slug)
        plans = cls.get_sorted_plans()
        prorated_credit = cls.calculate_prorated_credit(member)
        result = []
        
        for plan in plans:
            plan_rank = plan.rank if plan.rank and plan.rank != 99 else cls.get_plan_rank(plan.slug)
            is_upgrade = plan_rank > current_rank
            is_downgrade = plan_rank < current_rank
            is_current = plan.slug == current_slug
            
            full_price = float(plan.price) if plan.price else 0.0
            # A current plan is never an upgrade. This avoids showing a
            # nonsensical credit and a near-zero price on its own card.
            discount_amount = prorated_credit if is_upgrade and not is_current else 0.0
            upgrade_price = max(0.0, round(full_price - discount_amount, 2)) if is_upgrade else full_price

            result.append({
                'slug': plan.slug,
                'name': plan.name,
                'price': full_price,
                'upgrade_price': upgrade_price,
                'prorated_discount': discount_amount,
                'currency': plan.currency,
                'duration_days': plan.duration_days,
                'is_featured': plan.is_featured,
                'is_current': is_current,
                'is_upgrade': is_upgrade,
                'is_downgrade': is_downgrade,
                'is_purchasable': is_upgrade,
                'rank': plan_rank,
            })
        return result

    # ── Free plan activation ─────────────────────────────────

    @classmethod
    @transaction.atomic
    def activate_free_plan(cls, member) -> tuple[bool, str, MemberMembership | None]:
        from apps.core.services.membership_service import MembershipService
        plan = MembershipPlan.objects.filter(slug='free', is_active=True).first()
        if not plan:
            return False, 'Free plan is not available.', None

        member = Member.objects.select_for_update().get(pk=member.pk)

        existing = MemberMembership.objects.filter(
            member=member, is_active=True,
            status__in=[MemberMembership.MembershipStatus.ACTIVE, MemberMembership.MembershipStatus.EXPIRING_SOON],
        ).exclude(plan__slug='free').first()
        if existing:
            return False, 'You already have an active paid membership. Cancel it first.', None

        active_free = MemberMembership.objects.filter(
            member=member, is_active=True, plan__slug='free',
            status=MemberMembership.MembershipStatus.ACTIVE,
        ).first()
        if active_free:
            return False, 'Free plan is already active.', None

        MemberMembership.objects.filter(member=member, is_active=True).update(
            is_active=False,
            status=MemberMembership.MembershipStatus.CANCELLED,
            cancelled_at=timezone.now(),
        )

        now = timezone.now()
        end_date = now + timedelta(days=36500)
        membership = MemberMembership.objects.create(
            member=member,
            plan=plan,
            start_date=now,
            end_date=end_date,
            started_at=now,
            expires_at=end_date,
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
            activated_at=now,
            created_by='free_activation',
        )

        member.is_premium = False
        member.save(update_fields=['is_premium', 'updated_at'])

        return True, 'Free plan activated.', membership

    # ── Cancellation ─────────────────────────────────────────

    @classmethod
    @transaction.atomic
    def cancel_membership(cls, member, reason: str = '') -> tuple[bool, str]:
        from apps.core.services.membership_service import MembershipService
        member = Member.objects.select_for_update().get(pk=member.pk)

        active = MemberMembership.objects.filter(member=member, is_active=True).first()
        if not active:
            return False, 'No active membership to cancel.'

        active.is_active = False
        active.status = MemberMembership.MembershipStatus.CANCELLED
        active.cancelled_at = timezone.now()
        active.cancellation_reason = reason
        active.save(update_fields=['is_active', 'status', 'cancelled_at', 'cancellation_reason', 'updated_at'])

        member.is_premium = False
        member.save(update_fields=['is_premium', 'updated_at'])

        return True, 'Membership cancelled.'

    # ── Expiry processing ────────────────────────────────────

    @classmethod
    @transaction.atomic
    def check_and_process_expiry(cls, member) -> bool:
        from apps.core.services.membership_service import MembershipService
        return MembershipService.check_membership_expiry(member)

    @classmethod
    def process_batch_expiry(cls, batch_size: int = 100) -> dict:
        now = timezone.now()
        due = MemberMembership.objects.filter(
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
            expires_at__lte=now,
        ).select_related('member')[:batch_size]

        expired_count = 0
        for m in due:
            with transaction.atomic():
                member = Member.objects.select_for_update().get(pk=m.member_id)
                m.refresh_from_db()
                if m.expires_at and m.expires_at <= now and m.is_active:
                    m.is_active = False
                    m.status = MemberMembership.MembershipStatus.EXPIRED
                    m.save(update_fields=['is_active', 'status', 'updated_at'])
                    member.is_premium = False
                    member.save(update_fields=['is_premium', 'updated_at'])
                    expired_count += 1
        return {'expired': expired_count}

    @classmethod
    def mark_expiring_soon(cls, days_threshold: int = 7) -> int:
        now = timezone.now()
        threshold = now + timedelta(days=days_threshold)
        qs = MemberMembership.objects.filter(
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
            expires_at__lte=threshold,
            expires_at__gt=now,
        )
        count = qs.update(status=MemberMembership.MembershipStatus.EXPIRING_SOON)
        return count

    # ── Notification delivery ────────────────────────────────

    @classmethod
    def deliver_notification(cls, membership: MemberMembership, notification_type: str, channel: str = 'in_app', milestone: str = '') -> bool:
        try:
            NotificationDeliveryLog.objects.create(
                membership=membership,
                user=membership.member,
                notification_type=notification_type,
                milestone=milestone,
                channel=channel,
                delivery_status='sent',
            )
            return True
        except Exception:
            return False

    @classmethod
    def process_expiry_notifications(cls) -> dict:
        now = timezone.now()
        milestones = {
            '30_days': now + timedelta(days=30),
            '14_days': now + timedelta(days=14),
            '7_days': now + timedelta(days=7),
            '3_days': now + timedelta(days=3),
            '1_day': now + timedelta(days=1),
            'expired_today': now,
        }

        results = {}
        for milestone, threshold in milestones.items():
            qs = MemberMembership.objects.filter(
                is_active=True,
                status__in=[MemberMembership.MembershipStatus.ACTIVE, MemberMembership.MembershipStatus.EXPIRING_SOON],
                expires_at__lte=threshold,
            )
            if milestone != 'expired_today':
                qs = qs.filter(expires_at__gt=now)
            for m in qs:
                cls.deliver_notification(m, 'expiry_reminder', milestone=milestone)
            results[milestone] = qs.count()
        return results

    # ── Support tracking ────────────────────────────────────

    @classmethod
    def get_expiring_members_for_support(cls, days: int = 30) -> list[dict]:
        now = timezone.now()
        threshold = now + timedelta(days=days)
        qs = MemberMembership.objects.filter(
            is_active=True,
            status__in=[MemberMembership.MembershipStatus.ACTIVE, MemberMembership.MembershipStatus.EXPIRING_SOON],
            expires_at__lte=threshold,
            expires_at__gt=now,
        ).select_related('member', 'plan').order_by('expires_at')
        return [
            {
                'membership_id': str(m.id),
                'member_id': str(m.member_id),
                'member_name': m.member.get_full_name() or m.member.email,
                'email': m.member.email,
                'mobile': str(m.member.mobile_number or ''),
                'plan': m.plan.name if m.plan else 'N/A',
                'expires_at': m.expires_at.isoformat() if m.expires_at else None,
                'days_remaining': (m.expires_at - now).days if m.expires_at else None,
                'contact_status': getattr(getattr(m, 'support_tracking', None), 'contact_status', 'pending'),
            }
            for m in qs
        ]
