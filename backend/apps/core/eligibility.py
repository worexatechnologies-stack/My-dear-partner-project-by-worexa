from django.conf import settings
from django.db.models import Q
from apps.accounts.models import Member, AccountType
from apps.core.models import ProfileBlock

def get_eligible_profiles_for(user):
    """
    Returns a queryset of Member objects eligible to be viewed by the user.
    Enforces opposite gender filtering, status gates, visibility rules,
    and blocker/blocked relationship exclusions.
    """
    # 1. Opposite gender filtering strictly
    viewer_gender = str(user.gender).strip().lower()
    gender_filter = {}
    if viewer_gender == 'male':
        gender_filter['gender__iexact'] = 'female'
    elif viewer_gender == 'female':
        gender_filter['gender__iexact'] = 'male'
    else:
        # If no gender specified on viewer, default to returning nothing
        return Member.objects.none()

    # 2. Get blocker/blocked IDs to exclude
    blocked_ids = ProfileBlock.objects.filter(blocker=user).values_list('blocked_id', flat=True)
    blocker_ids = ProfileBlock.objects.filter(blocked=user).values_list('blocker_id', flat=True)

    # Verification is optional during the current member rollout.  We always
    # preserve visibility, account-state, gender, and block-list protections.
    filters = {
        'is_active': True,
        'deleted_at__isnull': True,
        'account_status': Member.AccountStatus.ACTIVE,
        'is_hidden': False,
        **gender_filter,
    }
    if getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False):
        filters['profile_status'] = Member.ProfileStatus.APPROVED

    queryset = Member.objects.filter(**filters)
    if getattr(settings, 'REQUIRE_MEMBER_VERIFICATION', False):
        queryset = queryset.filter(Q(is_email_verified=True) | Q(is_mobile_verified=True))

    queryset = queryset.exclude(pk=user.pk).exclude(pk__in=blocked_ids).exclude(pk__in=blocker_ids)
    return queryset
