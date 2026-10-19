from django.db import IntegrityError, transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Member, MemberProfile
from apps.core.api_utils import notify
from apps.core.models import Interest, ProfileBlock
from apps.core.services.match_closure_service import MatchClosureService
from apps.profiles.models import ProfilePhoto
from apps.profiles.serializers import MemberProfileDetailSerializer

from .models import MemberPass, MemberShortlist
from .serializers import MemberInterestSerializer


class ProfileBlockView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from apps.core.serializers import MemberPublicSerializer

        blocked_ids = ProfileBlock.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        members = (
            Member.objects.filter(pk__in=blocked_ids)
            .select_related('profile', 'preferences')
            .prefetch_related(
                Prefetch(
                    'profile_photos',
                    queryset=ProfilePhoto.objects.without_binary(),
                )
            )
            .order_by('first_name', 'last_name')
        )
        serialized = MemberPublicSerializer(members, many=True, context={'request': request}).data
        return Response({
            'success': True,
            'data': serialized,
        })

    @transaction.atomic
    def post(self, request):
        profile_id = request.data.get('profile_id') or request.data.get('member_id')
        if not profile_id:
            return Response({'detail': 'profile_id or member_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Direct Member lookup by pk
        target_member = Member.objects.filter(is_active=True, pk=profile_id).first()
        if not target_member:
            # 2. Lookup via MemberProfile id
            from apps.accounts.models import Member as AccountMember
            target_member = AccountMember.objects.filter(is_active=True, profile__id=profile_id).first()

        if not target_member:
            return Response({'detail': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        if target_member.pk == request.user.pk:
            return Response({'detail': 'You cannot block your own profile.'}, status=status.HTTP_400_BAD_REQUEST)

        block, created = ProfileBlock.objects.get_or_create(blocker=request.user, blocked=target_member)
        return Response(
            {'success': True, 'blocked': True, 'created': created, 'member_id': str(target_member.pk)},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @transaction.atomic
    def delete(self, request, member_id=None):
        if not member_id:
            return Response({'detail': 'member_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        deleted, _ = ProfileBlock.objects.filter(blocker=request.user, blocked_id=member_id).delete()
        if not deleted:
            # Check if member_id was a profile id
            target_member = Member.objects.filter(profile__id=member_id).first()
            if target_member:
                deleted, _ = ProfileBlock.objects.filter(blocker=request.user, blocked_id=target_member.pk).delete()

        if not deleted:
            return Response({'detail': 'Block not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'success': True, 'blocked': False, 'member_id': str(member_id)})


class ShortlistView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        blocked_pairs = ProfileBlock.objects.filter(
            Q(blocker=request.user) | Q(blocked=request.user)
        ).values_list('blocker_id', 'blocked_id')
        excluded_ids = {value for pair in blocked_pairs for value in pair}
        rows = (
            MemberShortlist.objects.filter(user=request.user)
            .exclude(profile__member_id__in=excluded_ids)
            .select_related("profile__member")
            .prefetch_related(
                Prefetch(
                    "profile__member__profile_photos",
                    queryset=ProfilePhoto.objects.without_binary(),
                )
            )
        )
        members = [row.profile.member for row in rows]
        return Response(MemberProfileDetailSerializer(members, many=True, context={"request": request}).data)

    @transaction.atomic
    def post(self, request):
        profile_id = request.data.get("profile_id")
        profile = get_object_or_404(
            MemberProfile.objects.select_related("member"),
            member_id=profile_id,
            member__is_active=True,
            member__deleted_at__isnull=True,
        )
        if profile.member_id == request.user.pk:
            return Response(
                {"detail": "You cannot shortlist your own profile."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if ProfileBlock.objects.filter(
            Q(blocker=request.user, blocked=profile.member) |
            Q(blocker=profile.member, blocked=request.user)
        ).exists():
            return Response({'detail': 'This profile is not available.'}, status=status.HTTP_403_FORBIDDEN)
        shortlist = MemberShortlist.objects.filter(user=request.user, profile=profile).first()
        if shortlist:
            shortlist.delete()
            return Response({"success": True, "action": "removed", "shortlisted": False})
        MemberShortlist.objects.create(user=request.user, profile=profile)
        return Response({"success": True, "action": "added", "shortlisted": True})


class PassListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        blocked_pairs = ProfileBlock.objects.filter(
            Q(blocker=request.user) | Q(blocked=request.user)
        ).values_list('blocker_id', 'blocked_id')
        excluded_ids = {value for pair in blocked_pairs for value in pair}

        # Mutually exclusive: profiles user has an active outgoing like to or an accepted match with
        # must never be counted as passed
        active_interest_pairs = set(
            Interest.objects.filter(
                Q(sender=request.user, status__in=[Interest.Status.PENDING, Interest.Status.ACCEPTED]) |
                Q(receiver=request.user, status=Interest.Status.ACCEPTED)
            )
            .values_list('receiver_id', 'sender_id')
        )
        active_member_ids = {mid for pair in active_interest_pairs for mid in pair if mid != request.user.pk}

        rows = (
            MemberPass.objects.filter(user=request.user)
            .exclude(profile__member_id__in=excluded_ids)
            .exclude(profile__member_id__in=active_member_ids)
            .select_related("profile__member")
            .prefetch_related(
                Prefetch(
                    "profile__member__profile_photos",
                    queryset=ProfilePhoto.objects.without_binary(),
                )
            )
        )
        
        members = [row.profile.member for row in rows]
        return Response(MemberProfileDetailSerializer(members, many=True, context={"request": request}).data)

    @transaction.atomic
    def post(self, request):
        profile_id = request.data.get("profile_id") or request.data.get("member_id")
        if not profile_id:
            return Response({"detail": "profile_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        profile_filter = Q(member_id=profile_id) | Q(member__id=profile_id)
        if str(profile_id).isdigit():
            profile_filter |= Q(id=int(profile_id))

        profile = MemberProfile.objects.filter(
            profile_filter,
            member__is_active=True,
            member__deleted_at__isnull=True,
        ).select_related("member").first()
        if not profile:
            return Response({"detail": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
        if profile.member_id == request.user.pk:
            return Response(
                {"detail": "You cannot pass your own profile."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj, created = MemberPass.objects.get_or_create(user=request.user, profile=profile)
        # Mutually exclusive: passing a profile withdraws/removes any pending interest sent to them
        Interest.objects.filter(
            sender=request.user,
            receiver=profile.member,
            status=Interest.Status.PENDING,
        ).delete()
        return Response({"success": True, "action": "passed", "created": created})

    @transaction.atomic
    def delete(self, request, profile_id=None):
        target_id = profile_id or request.data.get("profile_id") or request.data.get("member_id")
        if not target_id:
            deleted, _ = MemberPass.objects.filter(user=request.user).delete()
            return Response({"success": True, "action": "cleared", "deleted": bool(deleted)})
        
        pass_filter = Q(profile__member_id=target_id) | Q(profile__member__id=target_id)
        if str(target_id).isdigit():
            pass_filter |= Q(profile__id=int(target_id))

        deleted, _ = MemberPass.objects.filter(
            pass_filter,
            user=request.user,
        ).delete()
        return Response({"success": True, "action": "restored", "deleted": bool(deleted)})



class InterestListCreateView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        direction = request.query_params.get("type", "incoming").lower()
        if direction not in {"incoming", "outgoing"}:
            return Response(
                {"detail": "type must be incoming or outgoing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = Interest.objects.select_related(
            "sender",
            "receiver",
            "sender__profile",
            "receiver__profile",
        ).prefetch_related(
            Prefetch("sender__profile_photos", queryset=ProfilePhoto.objects.without_binary()),
            Prefetch("receiver__profile_photos", queryset=ProfilePhoto.objects.without_binary()),
        )
        queryset = (
            queryset.filter(receiver=request.user)
            if direction == "incoming"
            else queryset.filter(sender=request.user)
        ).exclude(status=Interest.Status.WITHDRAWN)
        return Response(MemberInterestSerializer(queryset, many=True, context={"request": request}).data)

    @transaction.atomic
    def post(self, request):
        receiver_id = request.data.get("receiver_id")
        receiver = get_object_or_404(
            Member.objects.filter(is_active=True, deleted_at__isnull=True).exclude(
                Q(pk__in=ProfileBlock.objects.filter(blocker=request.user).values('blocked_id')) |
                Q(pk__in=ProfileBlock.objects.filter(blocked=request.user).values('blocker_id'))
            ),
            pk=receiver_id,
        )
        if receiver.pk == request.user.pk:
            return Response(
                {"detail": "You cannot send an interest to yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Enforce the member's actual entitlements (free plan includes a small
        # daily interest allowance; premium plans allow more / unlimited).
        from apps.core.entitlement_service import MembershipEntitlementService

        allowed, reason = MembershipEntitlementService.can_send_interest(request.user)
        if not allowed:
            if reason == 'interest_not_included':
                detail = "An active membership plan is required to send interests. Please upgrade your plan."
                code = "MEMBERSHIP_REQUIRED"
            else:
                detail = reason  # e.g. "Interest limit of 3 per day has been reached."
                code = "DAILY_INTEREST_LIMIT"
            return Response(
                {"detail": detail, "code": code},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Mutually exclusive: if this member was previously passed, remove it from passes
        MemberPass.objects.filter(
            user=request.user,
            profile__member=receiver,
        ).delete()

        reverse = Interest.objects.select_for_update().filter(
            sender=receiver,
            receiver=request.user,
        ).first()
        if reverse:
            if reverse.status == Interest.Status.PENDING:
                reverse.status = Interest.Status.ACCEPTED
                reverse.save(update_fields=("status", "updated_at"))
                MatchClosureService.reopen_match(reverse.sender, reverse.receiver)
            if reverse.status == Interest.Status.ACCEPTED:
                # Also ensure any forward interest is synchronized as accepted
                existing = Interest.objects.filter(sender=request.user, receiver=receiver).first()
                if existing and existing.status != Interest.Status.ACCEPTED:
                    existing.status = Interest.Status.ACCEPTED
                    existing.save(update_fields=("status", "updated_at"))
                return Response(MemberInterestSerializer(reverse, context={"request": request}).data)

        existing = Interest.objects.select_for_update().filter(
            sender=request.user,
            receiver=receiver,
        ).first()
        if existing:
            if existing.status == Interest.Status.WITHDRAWN:
                existing.status = Interest.Status.PENDING
                existing.save(update_fields=("status", "updated_at"))
                self._dispatch_notification(existing)
                return Response(
                    MemberInterestSerializer(existing, context={"request": request}).data,
                )
            return Response(MemberInterestSerializer(existing, context={"request": request}).data)

        try:
            interest = Interest.objects.create(sender=request.user, receiver=receiver)
        except IntegrityError:
            # A concurrent duplicate is equivalent to the idempotent result
            # specified by this endpoint.
            interest = Interest.objects.get(sender=request.user, receiver=receiver)
            return Response(MemberInterestSerializer(interest, context={"request": request}).data)

        self._dispatch_notification(interest)
        return Response(
            MemberInterestSerializer(interest, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _dispatch_notification(interest):
        interest_id = str(interest.pk)

        def dispatch():
            try:
                from .tasks import send_interest_notification

                send_interest_notification.delay(interest_id)
            except Exception:
                # Notification delivery is intentionally best-effort and
                # never invalidates an already-created interest.
                pass

        # A worker must not see an interest until its transaction is durable.
        transaction.on_commit(dispatch)


class InterestDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def patch(self, request, pk):
        """Let the receiver accept a request again or remove an accepted match."""
        interest = get_object_or_404(
            Interest.objects.select_for_update(),
            pk=pk,
            receiver=request.user,
        )
        new_status = request.data.get("status")
        if new_status not in {Interest.Status.ACCEPTED, Interest.Status.DECLINED}:
            return Response(
                {"detail": "status must be ACCEPTED or DECLINED."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        allowed_current_statuses = (
            {Interest.Status.PENDING, Interest.Status.DECLINED}
            if new_status == Interest.Status.ACCEPTED
            else {Interest.Status.PENDING, Interest.Status.ACCEPTED}
        )
        if interest.status not in allowed_current_statuses:
            return Response(
                {"detail": "This interest can no longer be updated.", "code": "INTEREST_NOT_ACTIONABLE"},
                status=status.HTTP_409_CONFLICT,
            )

        closes_match = (
            interest.status == Interest.Status.ACCEPTED
            and new_status == Interest.Status.DECLINED
        )
        interest.status = new_status
        interest.save(update_fields=("status", "updated_at"))
        if new_status == Interest.Status.ACCEPTED:
            MatchClosureService.reopen_match(interest.sender, interest.receiver)
            # Synchronize any reciprocal interest between the two users
            Interest.objects.filter(
                sender=interest.receiver,
                receiver=interest.sender,
            ).update(status=Interest.Status.ACCEPTED)
            # Remove any pass record between the two users
            MemberPass.objects.filter(
                Q(user=interest.receiver, profile__member=interest.sender) |
                Q(user=interest.sender, profile__member=interest.receiver)
            ).delete()
        elif closes_match:
            MatchClosureService.close_match(interest, request.user)
            self._notify_match_removed(interest, request.user)
            Interest.objects.filter(
                sender=interest.receiver,
                receiver=interest.sender,
                status=Interest.Status.ACCEPTED,
            ).update(status=Interest.Status.DECLINED)

        return Response(MemberInterestSerializer(interest, context={"request": request}).data)

    @transaction.atomic
    def delete(self, request, pk):
        """Withdraw a sender's pending interest while preserving its history."""
        interest = get_object_or_404(
            Interest.objects.select_for_update(),
            pk=pk,
            sender=request.user,
        )
        if interest.status not in {Interest.Status.PENDING, Interest.Status.ACCEPTED}:
            return Response(
                {
                    "detail": "Only a pending interest or accepted match can be withdrawn.",
                    "code": "INTEREST_NOT_PENDING",
                },
                status=status.HTTP_409_CONFLICT,
            )

        closes_match = interest.status == Interest.Status.ACCEPTED
        interest.status = Interest.Status.WITHDRAWN
        interest.save(update_fields=("status", "updated_at"))
        if closes_match:
            MatchClosureService.close_match(interest, request.user)
            self._notify_match_removed(interest, request.user)
            Interest.objects.filter(
                sender=interest.receiver,
                receiver=interest.sender,
                status=Interest.Status.ACCEPTED,
            ).update(status=Interest.Status.WITHDRAWN)
        return Response(MemberInterestSerializer(interest, context={"request": request}).data)

    @staticmethod
    def _notify_match_removed(interest, removed_by):
        recipient = interest.receiver if interest.sender_id == removed_by.pk else interest.sender

        def dispatch():
            try:
                notify(
                    recipient,
                    notification_type="MATCH_REMOVED",
                    title="Match removed",
                    message="This match is no longer active.",
                    link_url="/interests/",
                    related_object=interest,
                )
            except Exception:
                # Notification delivery must not block a member's removal action.
                pass

        transaction.on_commit(dispatch)


def _find_candidate_member(target_id, excluded_ids=None):
    if not target_id:
        return None
    qs = Member.objects.filter(is_active=True, deleted_at__isnull=True)
    if excluded_ids:
        qs = qs.exclude(pk__in=excluded_ids)
    
    target_str = str(target_id).strip()
    import uuid
    try:
        val = uuid.UUID(target_str)
        member = qs.filter(pk=val).first()
        if member:
            return member
    except (ValueError, AttributeError):
        pass

    if target_str.isdigit():
        member = qs.filter(profile__id=int(target_str)).first()
        if member:
            return member

    return None


class CompatibilityDetailView(APIView):
    """Personalized bidirectional compatibility insights and scoring endpoint."""
    permission_classes = (IsAuthenticated,)

    def get(self, request, candidate_id=None):
        target_id = candidate_id or request.query_params.get('candidate_id') or request.query_params.get('member_id')
        return self._respond(request, target_id)

    def post(self, request, candidate_id=None):
        target_id = candidate_id or request.data.get('candidate_id') or request.data.get('member_id') or request.data.get('profile_id')
        return self._respond(request, target_id)

    def _respond(self, request, target_id):
        if not target_id:
            return Response({'detail': 'candidate_id or member_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Exclude blocked pairs
        blocked_ids = ProfileBlock.objects.filter(
            Q(blocker=request.user) | Q(blocked=request.user)
        ).values_list('blocker_id', 'blocked_id')
        excluded = {val for pair in blocked_ids for val in pair}

        target = _find_candidate_member(target_id, excluded_ids=excluded)

        if not target:
            return Response({'detail': 'Candidate not found or inaccessible.'}, status=status.HTTP_404_NOT_FOUND)

        if target.pk == request.user.pk:
            return Response({'detail': 'Cannot calculate compatibility with yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        from .services import MatchmakingService
        force_refresh = request.query_params.get('refresh') == 'true' or request.data.get('refresh') is True
        try:
            result = MatchmakingService.get_or_calculate_compatibility(
                viewer=request.user,
                candidate=target,
                use_ai=True,
                force_refresh=force_refresh,
            )
        except Exception:
            from .engine.scoring import calculate_compatibility
            result = calculate_compatibility(request.user, target)

        return Response({
            'success': True,
            'data': result,
            # Top-level mirrors for legacy callers
            'compatibility_score': result['compatibility_score'],
            'confidence': result['confidence'],
            'data_completeness': result['data_completeness'],
            'shared_strengths': result['shared_strengths'],
            'considerations': result['considerations'],
            'summary': result['summary'],
            'explanation': result['explanation'],
            'factors': result['factors'],
        })


class CompatibilityRecalculateView(APIView):
    """Force recalculation or cache invalidation for updated profiles and preferences."""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        candidate_id = request.data.get('candidate_id') or request.data.get('member_id')
        from .services import MatchmakingService

        if candidate_id:
            target = _find_candidate_member(candidate_id)
            if not target:
                return Response({'detail': 'Candidate not found.'}, status=status.HTTP_404_NOT_FOUND)

            try:
                result = MatchmakingService.get_or_calculate_compatibility(
                    viewer=request.user,
                    candidate=target,
                    use_ai=True,
                    force_refresh=True,
                )
            except Exception:
                from .engine.scoring import calculate_compatibility
                result = calculate_compatibility(request.user, target)

            return Response({'success': True, 'recalculated': True, 'data': result})

        # Recalculate/invalidate viewer's cached records
        invalidated_count = MatchmakingService.invalidate_for_member(request.user)
        return Response({
            'success': True,
            'invalidated_count': invalidated_count,
            'message': 'Compatibility caches successfully invalidated. Next views will recompute fresh.',
        })


class RecommendedMatchesView(APIView):
    """Top personalized recommended matches ordered by dynamic compatibility."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from apps.core.serializers import MemberPublicSerializer
        from .models import MemberPass
        from .services import MatchmakingService

        # Exclude blocked, passed, and own profile
        blocked_pairs = ProfileBlock.objects.filter(
            Q(blocker=request.user) | Q(blocked=request.user)
        ).values_list('blocker_id', 'blocked_id')
        excluded = {val for pair in blocked_pairs for val in pair}
        excluded.add(request.user.pk)

        passed_profile_ids = MemberPass.objects.filter(user=request.user).values_list('profile__member_id', flat=True)
        excluded.update(passed_profile_ids)

        # Opposite gender preference default if specified
        queryset = Member.objects.filter(is_active=True, deleted_at__isnull=True).exclude(pk__in=excluded)
        if request.user.gender:
            opp_gender = 'FEMALE' if request.user.gender.upper() == 'MALE' else 'MALE'
            queryset = queryset.filter(gender__iexact=opp_gender)

        candidates = list(
            queryset.select_related('profile', 'preferences')
            .prefetch_related(
                Prefetch(
                    'profile_photos',
                    queryset=ProfilePhoto.objects.without_binary(),
                )
            )[:50]
        )

        # Score dynamically and sort by score descending
        scored_candidates = []
        for cand in candidates:
            score = MatchmakingService.get_quick_compatibility_score(request.user, cand)
            scored_candidates.append((score, cand))

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        top_candidates = [cand for _, cand in scored_candidates[:20]]

        serializer = MemberPublicSerializer(top_candidates, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': len(top_candidates),
            'results': serializer.data,
        })

