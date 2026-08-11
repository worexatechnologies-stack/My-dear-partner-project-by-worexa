import zoneinfo
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from apps.accounts.models import Member
from apps.core.models import ProfileUnlock, Interest, ProfileBlock
from apps.core.entitlements import get_active_entitlements

class MembershipEntitlementService:
    @staticmethod
    def get_effective_plan(user):
        """
        Returns the active MemberMembership plan model instance, or None if Free.
        Casts parent class BaseAccount to Member subclass if necessary.
        """
        try:
            if not isinstance(user, Member):
                user = Member.objects.filter(pk=user.pk).first()
                if not user:
                    return None

            if getattr(user, 'account_status', 'ACTIVE') != 'ACTIVE' or not user.is_active:
                return None

            from apps.core.models import MemberMembership
            membership = MemberMembership.objects.select_related('plan').filter(
                member=user,
                is_active=True,
                status=MemberMembership.MembershipStatus.ACTIVE,
            ).order_by('-started_at', '-created_at').first()
            if membership and membership.plan_id:
                expiry = membership.expires_at or membership.end_date
                if expiry and expiry <= timezone.now():
                    return None
                return membership.plan
        except Exception:
            pass
        return None

    @staticmethod
    def is_limit_available(limit, used):
        """
        Centralized helper: Returns True if limit is None or used < limit.
        """
        return limit is None or used < limit

    @classmethod
    def can_unlock_profile(cls, user, target_profile):
        """
        Checks if the viewer can unlock the profile details.
        Returns (allowed, reason, access_data).
        """
        if user.pk == target_profile.pk:
            return True, "Own profile", {"is_unlocked": True, "unlock_consumed": False}

        kolkata_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        today = timezone.now().astimezone(kolkata_tz).date()

        # Check if already unlocked today
        already_unlocked = ProfileUnlock.objects.filter(
            viewer=user,
            profile=target_profile,
            usage_date=today
        ).exists()

        entitlements = get_active_entitlements(user)
        limit = entitlements.daily_profile_view_limit
        used_today = ProfileUnlock.objects.filter(viewer=user, usage_date=today).count()

        if already_unlocked:
            return True, "Already unlocked today", {
                "is_unlocked": True,
                "unlock_consumed": False,
                "daily_limit": limit,
                "used_today": used_today,
                "remaining_today": max(0, limit - used_today) if limit is not None else None
            }

        # Check daily limit
        if not cls.is_limit_available(limit, used_today):
            return False, "You have used all profile unlocks available today.", {
                "daily_limit": limit,
                "used_today": used_today,
                "remaining_today": 0
            }

        return True, "Can unlock", {
            "is_unlocked": False,
            "unlock_consumed": True,
            "daily_limit": limit,
            "used_today": used_today,
            "remaining_today": max(0, limit - used_today) if limit is not None else None
        }

    @classmethod
    def can_send_interest(cls, user):
        """
        Checks if the user can send a new interest.
        Returns (allowed, reason).
        """
        entitlements = get_active_entitlements(user)
        if not entitlements.can_send_interest:
            return False, 'interest_not_included'
        limit = entitlements.daily_interest_limit

        kolkata_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        today = timezone.now().astimezone(kolkata_tz).date()

        used_today = Interest.objects.filter(
            sender=user,
            created_at__date=today
        ).exclude(
            status=Interest.Status.DECLINED
        ).count()

        if not cls.is_limit_available(limit, used_today):
            return False, f"Interest limit of {limit} per day has been reached."
        return True, "Allowed"

    @classmethod
    def can_message(cls, user, target_user):
        """
        Checks if messaging is allowed between user and target_user.
        Returns (allowed, reason).
        """
        entitlements = get_active_entitlements(user)
        if not entitlements.can_chat:
            return False, "messaging_not_included"

        limit = entitlements.daily_message_limit
        if limit is not None:
            kolkata_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
            today = timezone.now().astimezone(kolkata_tz).date()
            from apps.core.models import ChatMessage
            sent_today = ChatMessage.objects.filter(
                sender=user,
                created_at__date=today,
            ).count()
            if sent_today >= limit:
                return False, "DAILY_MESSAGE_LIMIT_REACHED"

        # Check target user status
        target_member = Member.objects.filter(pk=target_user.pk).first()
        if (
            not target_member
            or not target_member.is_active
            or target_member.deleted_at is not None
            or target_member.account_status != Member.AccountStatus.ACTIVE
            or target_member.is_hidden
            or (
                getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False)
                and target_member.profile_status != Member.ProfileStatus.APPROVED
            )
        ):
            return False, "target_ineligible"

        # Check blocker relationship
        is_blocked = ProfileBlock.objects.filter(
            Q(blocker=user, blocked=target_user) | Q(blocker=target_user, blocked=user)
        ).exists()
        if is_blocked:
            return False, "messaging_blocked"

        # Enforce mutual interest requirement for Gold (MUTUAL_ONLY)
        plan = cls.get_effective_plan(user)
        default_mode = 'ENABLED' if getattr(settings, 'DEBUG', False) else 'DISABLED'
        messaging_mode = getattr(plan, 'messaging_mode', default_mode) if plan else default_mode
        if messaging_mode == 'MUTUAL_ONLY':
            # Check if there is mutual accepted interest
            has_mutual = Interest.objects.filter(
                Q(sender=user, receiver=target_user, status=Interest.Status.ACCEPTED) |
                Q(sender=target_user, receiver=user, status=Interest.Status.ACCEPTED)
            ).exists()
            if not has_mutual:
                return False, "messaging_requires_mutual_interest"

        return True, "Allowed"

    @classmethod
    def can_connect_chat(cls, user, target_user):
        """
        Lightweight connection check for WebSocket — allows connecting even
        when the daily message limit is hit, so the user can still receive
        messages in real time. The daily limit is enforced at send time.
        """
        entitlements = get_active_entitlements(user)
        if not entitlements.can_chat:
            return False, "messaging_not_included"

        target_member = Member.objects.filter(pk=target_user.pk).first()
        if (
            not target_member
            or not target_member.is_active
            or target_member.deleted_at is not None
            or target_member.account_status != Member.AccountStatus.ACTIVE
            or target_member.is_hidden
            or (
                getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False)
                and target_member.profile_status != Member.ProfileStatus.APPROVED
            )
        ):
            return False, "target_ineligible"

        is_blocked = ProfileBlock.objects.filter(
            Q(blocker=user, blocked=target_user) | Q(blocker=target_user, blocked=user)
        ).exists()
        if is_blocked:
            return False, "messaging_blocked"

        plan = cls.get_effective_plan(user)
        default_mode = 'ENABLED' if getattr(settings, 'DEBUG', False) else 'DISABLED'
        messaging_mode = getattr(plan, 'messaging_mode', default_mode) if plan else default_mode
        if messaging_mode == 'MUTUAL_ONLY':
            has_mutual = Interest.objects.filter(
                Q(sender=user, receiver=target_user, status=Interest.Status.ACCEPTED) |
                Q(sender=target_user, receiver=user, status=Interest.Status.ACCEPTED)
            ).exists()
            if not has_mutual:
                return False, "messaging_requires_mutual_interest"

        return True, "Allowed"

    @classmethod
    def can_view_contact(cls, user, target_user):
        """
        Checks if the viewer has contact access to target_user.
        Returns (allowed, mode).
        """
        # Exclude blocked/suspended/deactivated targets
        target_member = Member.objects.filter(pk=target_user.pk).first()
        if (
            not target_member
            or not target_member.is_active
            or (
                getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False)
                and target_member.profile_status != Member.ProfileStatus.APPROVED
            )
        ):
            return False, "NONE"

        is_blocked = ProfileBlock.objects.filter(
            Q(blocker=user, blocked=target_user) | Q(blocker=target_user, blocked=user)
        ).exists()
        if is_blocked:
            return False, "NONE"

        entitlements = get_active_entitlements(user)
        contact_mode = entitlements.contact_access_mode

        if contact_mode == 'NONE':
            return False, "NONE"

        if contact_mode == 'MUTUAL_ONLY':
            # Must have accepted mutual interest
            has_mutual = Interest.objects.filter(
                Q(sender=user, receiver=target_user, status=Interest.Status.ACCEPTED) |
                Q(sender=target_user, receiver=user, status=Interest.Status.ACCEPTED)
            ).exists()
            if has_mutual:
                return True, "MUTUAL_ONLY"
            return False, "MUTUAL_ONLY"

        if contact_mode == 'FULL':
            # Full contact access allowed after target has been unlocked
            is_unlocked = ProfileUnlock.objects.filter(viewer=user, profile=target_user).exists()
            if is_unlocked:
                return True, "FULL"
            return False, "FULL"

        return False, "NONE"

    @classmethod
    def get_photo_access_mode(cls, user):
        """
        Returns 'PRIMARY_ONLY' or 'ALL_APPROVED'.
        """
        return get_active_entitlements(user).photo_access_mode
