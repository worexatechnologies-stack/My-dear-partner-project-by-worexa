"""
Profile Service

Handles profile-related business logic:
- Profile search with eligibility filtering
- Full profile retrieval with unlock logic
- Profile visibility rules
- Contact and photo access rules
"""

from datetime import timedelta

from django.conf import settings
from django.db.models import Case, Exists, IntegerField, OuterRef, Prefetch, Q, Value, When
from django.utils import timezone

from apps.accounts.models import Member
from apps.core.eligibility import get_eligible_profiles_for
from apps.core.models import MemberMembership, ProfileBlock, ProfileViewLog
from apps.profiles.models import ProfilePhoto
from .membership_service import MembershipService
from .match_closure_service import MatchClosureService
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
        
        # ── Professional matrimonial ranking (server-side, single query) ──
        # Eligibility has already been fully enforced above. This blocks only
        # re-orders the *eligible* pool. The score deliberately interleaves
        # premium/boost with compatibility & profile quality so the feed feels
        # organic, never a stiff "premium section".
        now = timezone.now()

        # Active membership with a boost entitlement, that has NOT expired.
        boosted_active = MemberMembership.objects.filter(
            member=OuterRef('pk'),
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
            plan__can_use_profile_boost=True,
        ).exclude(
            Q(end_date__isnull=False, end_date__lt=now)
            | Q(expires_at__isnull=False, expires_at__lt=now)
        ).values('pk')[:1]

        # Active premium (any non-expired membership on a paid plan) — used for
        # the premium advantage independent of an explicit boost entitlement.
        premium_active = MemberMembership.objects.filter(
            member=OuterRef('pk'),
            is_active=True,
            status=MemberMembership.MembershipStatus.ACTIVE,
            plan__is_active=True,
        ).exclude(
            Q(end_date__isnull=False, end_date__lt=now)
            | Q(expires_at__isnull=False, expires_at__lt=now)
        ).values('pk')[:1]

        # The viewer's own stated preferences drive a compatibility bump.
        # Everything here uses real data (no invented completeness values).
        viewer_prefs = None
        try:
            viewer_prefs = viewer.preferences
        except Exception:
            viewer_prefs = None

        pref_age_min = getattr(viewer_prefs, 'preferred_age_min', None)
        pref_age_max = getattr(viewer_prefs, 'preferred_age_max', None)
        pref_religion = (getattr(viewer_prefs, 'preferred_religion', '') or '').strip()
        pref_caste = (getattr(viewer_prefs, 'preferred_caste', '') or '').strip()
        pref_location = (getattr(viewer_prefs, 'preferred_location', '') or '').strip()
        pref_education = (getattr(viewer_prefs, 'preferred_education', '') or '').strip()
        pref_occupation = (getattr(viewer_prefs, 'preferred_occupation', '') or '').strip()
        pref_marital = (getattr(viewer_prefs, 'preferred_marital_status', '') or '').strip()
        today = timezone.now().date()

        def pref_cutoff(years):
            try:
                return today.replace(year=today.year - years)
            except ValueError:
                return today.replace(year=today.year - years, day=28)

        # Age compatibility: candidate falls inside the viewer's preferred band.
        compat_age = Case(default=Value(0), output_field=IntegerField())
        if pref_age_min and pref_age_max:
            dob_min = pref_cutoff(pref_age_max + 1)   # age <= max  ->  dob > dob_min
            dob_max = pref_cutoff(pref_age_min)        # age >= min  ->  dob <= dob_max
            compat_age = Case(
                When(
                    Q(date_of_birth__gt=dob_min) & Q(date_of_birth__lte=dob_max),
                    then=Value(1),
                ),
                default=Value(0),
                output_field=IntegerField(),
            )

        # Each compatibility bump is a real Case expression stored in a local
        # variable. (annotate(alias=...) does NOT create a Python name, so the
        # score below must reference these variables, never the ``_compat_*``
        # alias strings.)
        compat_religion = Case(
            When(profile__religion__iexact=pref_religion, then=Value(1)) if pref_religion else When(pk__isnull=False, then=Value(0)),
            default=Value(0),
            output_field=IntegerField(),
        )
        compat_caste = Case(
            When(profile__caste__iexact=pref_caste, then=Value(1)) if pref_caste else When(pk__isnull=False, then=Value(0)),
            default=Value(0),
            output_field=IntegerField(),
        )
        compat_location = Case(
            When(profile__work_location__icontains=pref_location, then=Value(1)) if pref_location else When(pk__isnull=False, then=Value(0)),
            default=Value(0),
            output_field=IntegerField(),
        )
        compat_education = Case(
            When(profile__highest_education__iexact=pref_education, then=Value(1)) if pref_education else When(pk__isnull=False, then=Value(0)),
            default=Value(0),
            output_field=IntegerField(),
        )
        compat_occupation = Case(
            When(profile__occupation__iexact=pref_occupation, then=Value(1)) if pref_occupation else When(pk__isnull=False, then=Value(0)),
            default=Value(0),
            output_field=IntegerField(),
        )
        compat_marital = Case(
            When(profile__marital_status__iexact=pref_marital, then=Value(1)) if pref_marital else When(pk__isnull=False, then=Value(0)),
            default=Value(0),
            output_field=IntegerField(),
        )

        # Single combined quality score is computed in SQL (no N+1).
        queryset = queryset.annotate(
            _boosted=Exists(boosted_active),
            _active_premium=Exists(premium_active),
            _verified_flag=Case(
                When(is_mobile_verified=True, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            _photo_ok=Case(
                When(photo_status=Member.VerificationStatus.APPROVED, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            _about_ok=Case(
                When(~Q(profile__about='') & ~Q(profile__about__isnull=True), then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            _recent_ok=Case(
                When(Q(last_seen_at__gte=now - timedelta(days=14)) | Q(created_at__gte=now - timedelta(days=30)), then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            _compat_age=compat_age,
            _compat_religion=compat_religion,
            _compat_caste=compat_caste,
            _compat_location=compat_location,
            _compat_education=compat_education,
            _compat_occupation=compat_occupation,
            _compat_marital=compat_marital,
        )

        # Weighted score. High-compatible, verified, complete, recently-active
        # free profiles can still outrank a bare low-quality premium profile.
        queryset = queryset.annotate(
            _rank_score=(
                Case(When(_boosted=True, then=Value(800)), default=Value(0))
                + Case(When(_active_premium=True, then=Value(700)), default=Value(0))
                + Case(When(_boosted=True, _active_premium=True, then=Value(600)), default=Value(0))
                + Case(When(_verified_flag=1, then=Value(300)), default=Value(0))
                + Case(When(_photo_ok=1, then=Value(400)), default=Value(0))
                + Case(When(_about_ok=1, then=Value(150)), default=Value(0))
                + Case(When(_recent_ok=1, then=Value(250)), default=Value(0))
                + compat_age * Value(400, output_field=IntegerField())
                + compat_religion * Value(450, output_field=IntegerField())
                + compat_caste * Value(400, output_field=IntegerField())
                + compat_location * Value(350, output_field=IntegerField())
                + compat_education * Value(450, output_field=IntegerField())
                + compat_occupation * Value(400, output_field=IntegerField())
                + compat_marital * Value(400, output_field=IntegerField())
            )
        )
        return queryset.order_by('-_rank_score', '-_photo_ok', '-_recent_ok', '-created_at', 'pk').distinct()
    
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

        # Instagram-style block handling. If the target has blocked the viewer,
        # refuse the view regardless of anything else so the UI can present a
        # clear "You have been blocked by this user" state instead of a generic
        # 404. If the viewer blocked the target, allow the view (the blocker
        # may still unblock), and flag the relationship for the UI.
        target_blocked_viewer = ProfileBlock.objects.filter(
            blocker_id=profile_id, blocked=viewer
        ).exists()
        if target_blocked_viewer:
            return (
                False,
                'You have been blocked by this user.',
                {'code': 'blocked_by_user'}
            )
        viewer_blocked_target = ProfileBlock.objects.filter(
            blocker=viewer, blocked_id=profile_id
        ).exists()

        # Get eligible profile
        eligible_profiles = get_eligible_profiles_for(viewer).select_related(
            'profile', 'preferences'
        ).prefetch_related(
            Prefetch('profile_photos', queryset=ProfilePhoto.objects.active().without_binary())
        )

        try:
            member = eligible_profiles.get(pk=profile_id)
        except Member.DoesNotExist:
            # The viewer is blocked by someone they never blocked: the only
            # way to hit this branch is a hard URL / history reference, so
            # prefer the friendly blocked notice when applicable.
            if viewer_blocked_target:
                return (
                    False,
                    'You have blocked this user.',
                    {'code': 'you_blocked', 'blocked_profile_locked': True}
                )
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

        # Calculate compatibility from the viewer's saved preferences only.
        from apps.core.matching import calculate_profile_compatibility

        compatibility = calculate_profile_compatibility(viewer, member)
        
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
                'blocked_by_me': viewer_blocked_target,
                'blocked_by_user': False,
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
        Check whether the viewer can open a chat with the target.
        
        Args:
            viewer: Member sending message
            target: Member receiving message
            
        Returns:
            tuple: (allowed: bool, reason: str)
        """
        # Keep the profile action in sync with the HTTP and WebSocket chat
        # authorization path. In particular, a current free-trial entitlement
        # can enable chat even though it has no MemberMembership row.
        from apps.core.entitlement_service import MembershipEntitlementService

        return MembershipEntitlementService.can_connect_chat(viewer, target)
    
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

        if MatchClosureService.has_closed_match(viewer, target):
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
