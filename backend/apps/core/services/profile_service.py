"""
Profile Service

Handles profile-related business logic:
- Profile search with eligibility filtering
- Full profile retrieval with unlock logic
- Profile visibility rules
- Contact and photo access rules
"""

from django.conf import settings
from django.db.models import Case, Exists, IntegerField, OuterRef, Prefetch, Q, Value, When
from django.utils import timezone

from apps.accounts.models import Member
from apps.core.eligibility import get_eligible_profiles_for
from apps.core.models import MemberMembership, ProfileBlock, ProfileViewLog
from apps.profiles.models import ProfilePhoto
from .membership_service import MembershipService
from .profile_unlock_service import ProfileUnlockService
from .interest_service import InterestService


class ProfileService:
    """
    Centralized service for profile operations.
    """
    
    @staticmethod
    def search_profiles(viewer, filters=None):
        """
        Search profiles with eligibility filtering.
        
        Args:
            viewer: Member performing the search
            filters: dict of search filters (optional)
                - search: text search
                - location: location filter
                - min_age, max_age: age range
                - caste, marital_status, education, occupation, religion: advanced filters
                
        Returns:
            QuerySet: Filtered profile queryset
        """
        # Get eligible profiles (opposite gender, active, approved, non-blocked)
        queryset = get_eligible_profiles_for(viewer).select_related(
            'profile', 'preferences'
        ).prefetch_related(
            Prefetch('profile_photos', queryset=ProfilePhoto.objects.active().without_binary())
        )

        filters = filters or {}
        
        # Basic text search (allowed for all plans)
        search = filters.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(profile__occupation__icontains=search) |
                Q(profile__work_location__icontains=search)
            )
        
        # Location filter (allowed for all plans)
        location = filters.get('location', '').strip()
        if location:
            queryset = queryset.filter(profile__work_location__icontains=location)

        # Gender is intentionally absent: eligibility owns the platform's
        # opposite-gender discovery rule and cannot be overridden by search.

        # Calendar-accurate age range with explicit validation.
        today = timezone.now().date()
        min_age = filters.get('min_age', '').strip()
        max_age = filters.get('max_age', '').strip()

        for value, label in ((min_age, 'min_age'), (max_age, 'max_age')):
            if value and (not value.isdigit() or not 18 <= int(value) <= 100):
                raise ValueError(f'{label} must be a whole number between 18 and 100.')
        if min_age and max_age and int(min_age) > int(max_age):
            raise ValueError('min_age cannot be greater than max_age.')

        def birthday_cutoff(years):
            try:
                return today.replace(year=today.year - years)
            except ValueError:
                return today.replace(year=today.year - years, day=28)

        if min_age:
            queryset = queryset.filter(date_of_birth__lte=birthday_cutoff(int(min_age)))
        if max_age:
            queryset = queryset.filter(date_of_birth__gt=birthday_cutoff(int(max_age) + 1))

        for param, lookup in {
            'religion': 'profile__religion__iexact',
            'mother_tongue': 'profile__mother_tongue__iexact',
        }.items():
            value = filters.get(param, '').strip()
            if value:
                queryset = queryset.filter(**{lookup: value})

        marital_status = filters.get('marital_status', '').strip()
        if marital_status:
            variants = {marital_status, marital_status.replace('_', ' ')}
            marital_query = Q()
            for variant in variants:
                marital_query |= Q(profile__marital_status__iexact=variant)
            queryset = queryset.filter(marital_query)
        
        advanced_filters = {
            'caste': 'profile__caste__icontains',
            'education': 'profile__highest_education__icontains',
            'occupation': 'profile__occupation__icontains',
        }
        for param, lookup in advanced_filters.items():
            value = filters.get(param, '').strip()
            if value:
                queryset = queryset.filter(**{lookup: value})
        
        # Rank profiles with an approved photo first, then boosted members
        # (active membership with profile boost enabled), then premium, then
        # newest first. This surfaces approved-photo profiles ahead of
        # not-approved ones and makes a purchased "profile boost" plan actually
        # improve search visibility instead of being an unused entitlement flag.
        boosted = MemberMembership.objects.filter(
            member=OuterRef('pk'),
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
            plan__can_use_profile_boost=True,
        ).values('pk')[:1]

        queryset = queryset.annotate(
            _photo_rank=Case(
                When(photo_status=Member.VerificationStatus.APPROVED, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            ),
            _boosted=Exists(boosted),
        )
        return queryset.order_by('_photo_rank', '-_boosted', '-is_premium', '-created_at', 'pk').distinct()
    
    @staticmethod
    def get_full_profile(viewer, profile_id, source='search'):
        """
        Get full profile details with unlock logic.
        
        Args:
            viewer: Member viewing the profile
            profile_id: UUID of profile to view
            source: Source page for unlock tracking
            
        Returns:
            tuple: (success: bool, message: str, data: dict or None)
        """
        # Prevent viewing own profile via this endpoint
        if str(profile_id) == str(viewer.pk):
            return (
                False,
                'Use the member-auth me endpoint for your own profile.',
                None
            )
        
        # Get eligible profile
        eligible_profiles = get_eligible_profiles_for(viewer).select_related(
            'profile', 'preferences'
        ).prefetch_related(
            Prefetch('profile_photos', queryset=ProfilePhoto.objects.active().without_binary())
        )
        
        try:
            member = eligible_profiles.get(pk=profile_id)
        except Member.DoesNotExist:
            return (
                False,
                'This profile is not available.',
                None
            )
        
        # Try to unlock profile
        allowed, reason, access_data = ProfileUnlockService.unlock_profile(
            viewer, member, source
        )
        
        if not allowed:
            # Return limit response
            return (
                False,
                reason,
                {
                    'code': 'daily_profile_unlock_limit_reached',
                    'limit': access_data.get('daily_limit'),
                    'used': access_data.get('used_today'),
                    'remaining': access_data.get('remaining_today'),
                    'resets_at': access_data.get('resets_at'),
                }
            )

        ProfileViewLog.objects.create(
            viewer=viewer,
            viewed=member,
            view_date=timezone.now().date(),
        )

        # Calculate compatibility
        from apps.core.matching import get_compatibility_provider
        provider = get_compatibility_provider()
        compatibility = provider.calculate(viewer, member)
        
        # Get interest usage
        interest_usage = InterestService.get_daily_usage(viewer)
        
        # Check messaging permission
        can_message, _ = ProfileService.can_message(viewer, member)
        
        # Check contact visibility
        contact_allowed, contact_mode = ProfileService.can_view_contact(viewer, member)
        
        # Get photo access mode
        photo_mode = ProfileService.get_photo_access_mode(viewer)
        
        # Get plan info
        plan = MembershipService.get_effective_plan(viewer)
        
        return (
            True,
            'Profile retrieved successfully',
            {
                'profile': member,  # Serialized by view
                'compatibility': {
                    'score': compatibility['score'],
                    'explanations': compatibility['explanations'],
                },
                'access': {
                    'plan': plan.name if plan else 'Free',
                    'profile_unlocked': True,
                    'unlock_consumed': access_data.get('unlock_consumed', False),
                    'daily_unlock_limit': access_data.get('daily_limit'),
                    'unlocks_used_today': access_data.get('used_today'),
                    'unlocks_remaining_today': access_data.get('remaining_today'),
                    'can_send_interest': interest_usage['remaining_today'] is None or interest_usage['remaining_today'] > 0,
                    'interests_remaining_today': interest_usage['remaining_today'],
                    'can_message': can_message,
                    'contact_access_mode': contact_mode.lower(),
                    'photo_access_mode': photo_mode.lower(),
                    'resets_at': access_data.get('resets_at'),
                },
            }
        )
    
    @staticmethod
    def can_message(viewer, target):
        """
        Check if viewer can message target.
        
        Args:
            viewer: Member sending message
            target: Member receiving message
            
        Returns:
            tuple: (allowed: bool, reason: str)
        """
        # Check messaging mode and can_message flag
        plan = MembershipService.get_effective_plan(viewer)
        can_msg = getattr(plan, 'can_message', False) if plan else False
        messaging_mode = getattr(plan, 'messaging_mode', 'DISABLED') if plan else 'DISABLED'
        
        if not can_msg and messaging_mode == 'DISABLED':
            return False, 'messaging_not_included'
        
        # Check target eligibility
        if (
            not target.is_active
            or target.deleted_at is not None
            or target.account_status != Member.AccountStatus.ACTIVE
            or target.is_hidden
            or (
                getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False)
                and target.profile_status != Member.ProfileStatus.APPROVED
            )
        ):
            return False, 'target_ineligible'
        
        # Check blocked relationships
        is_blocked = ProfileBlock.objects.filter(
            Q(blocker=viewer, blocked=target) | Q(blocker=target, blocked=viewer)
        ).exists()
        
        if is_blocked:
            return False, 'messaging_blocked'
        
        # Check mutual interest requirement for MUTUAL_ONLY mode
        if messaging_mode == 'MUTUAL_ONLY':
            if not InterestService.has_mutual_interest(viewer, target):
                return False, 'messaging_requires_mutual_interest'
        
        return True, 'Allowed'
    
    @staticmethod
    def can_view_contact(viewer, target):
        """
        Check if viewer can see contact details of target.
        
        Args:
            viewer: Member viewing
            target: Member being viewed
            
        Returns:
            tuple: (allowed: bool, mode: str)
        """
        # Check target eligibility
        if (
            not target.is_active
            or (
                getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False)
                and target.profile_status != Member.ProfileStatus.APPROVED
            )
        ):
            return False, 'NONE'
        
        # Check blocked relationships
        is_blocked = ProfileBlock.objects.filter(
            Q(blocker=viewer, blocked=target) | Q(blocker=target, blocked=viewer)
        ).exists()
        
        if is_blocked:
            return False, 'NONE'
        
        plan = MembershipService.get_effective_plan(viewer)
        contact_mode = getattr(plan, 'contact_access_mode', 'NONE') if plan else 'NONE'
        
        if contact_mode == 'NONE':
            return False, 'NONE'
        
        if contact_mode == 'MUTUAL_ONLY':
            # Must have accepted mutual interest
            if InterestService.has_mutual_interest(viewer, target):
                return True, 'MUTUAL_ONLY'
            return False, 'MUTUAL_ONLY'
        
        if contact_mode == 'FULL':
            # Full contact access allowed after target has been unlocked
            is_unlocked = ProfileUnlockService.has_unlocked_profile(viewer, target)
            if is_unlocked:
                return True, 'FULL'
            return False, 'FULL'
        
        return False, 'NONE'
    
    @staticmethod
    def get_photo_access_mode(viewer):
        """
        Get photo access mode for viewer.
        
        Args:
            viewer: Member instance
            
        Returns:
            str: 'PRIMARY_ONLY' or 'ALL_APPROVED'
        """
        plan = MembershipService.get_effective_plan(viewer)
        return getattr(plan, 'photo_access_mode', 'PRIMARY_ONLY') if plan else 'PRIMARY_ONLY'
