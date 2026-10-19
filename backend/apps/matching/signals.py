"""
Signals for Matchmaking compatibility invalidation.

Automatically invalidates cached compatibility evaluations when profile attributes
or partner preferences change.
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.accounts.models import MemberProfile, MemberPreference
from .services import MatchmakingService


@receiver(post_save, sender=MemberProfile)
def on_member_profile_updated(sender, instance, **kwargs):
    """Invalidate compatibility cache when profile details change."""
    member = getattr(instance, 'member', None)
    if member:
        MatchmakingService.invalidate_for_member(member)


@receiver(post_save, sender=MemberPreference)
def on_member_preference_updated(sender, instance, **kwargs):
    """Invalidate compatibility cache when partner preferences change."""
    member = getattr(instance, 'member', None)
    if member:
        MatchmakingService.invalidate_for_member(member)
