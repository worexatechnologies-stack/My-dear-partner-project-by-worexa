"""Shared match-closure rules used by interests, chat, and contact access."""

from django.db.models import Q

from apps.core.models import MatchClosure


class MatchClosureService:
    @staticmethod
    def _pair_query(first_member, second_member):
        return (
            Q(
                interest__sender_id=first_member.pk,
                interest__receiver_id=second_member.pk,
            )
            | Q(
                interest__sender_id=second_member.pk,
                interest__receiver_id=first_member.pk,
            )
        )

    @classmethod
    def has_closed_match(cls, first_member, second_member):
        return MatchClosure.objects.filter(
            cls._pair_query(first_member, second_member)
        ).exists()

    @classmethod
    def close_match(cls, interest, closed_by):
        if closed_by.pk not in {interest.sender_id, interest.receiver_id}:
            raise PermissionError('Only a participant can remove this match.')
        return MatchClosure.objects.get_or_create(
            interest=interest,
            defaults={'closed_by': closed_by},
        )

    @classmethod
    def reopen_match(cls, first_member, second_member):
        """Clear an old closure only after a member explicitly accepts again."""
        return MatchClosure.objects.filter(
            cls._pair_query(first_member, second_member)
        ).delete()[0]

    @staticmethod
    def closed_partner_ids(member):
        """Return partners whose historical conversations must stay hidden."""
        closures = (
            MatchClosure.objects.filter(
                Q(interest__sender_id=member.pk) | Q(interest__receiver_id=member.pk)
            )
            .select_related('interest')
        )
        return {
            closure.interest.receiver_id
            if closure.interest.sender_id == member.pk
            else closure.interest.sender_id
            for closure in closures
        }
