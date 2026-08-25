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

from .models import MemberShortlist
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
        profile = get_object_or_404(Member.objects.filter(is_active=True), pk=profile_id)
        if profile.pk == request.user.pk:
            return Response({'detail': 'You cannot block your own profile.'}, status=status.HTTP_400_BAD_REQUEST)
        block, created = ProfileBlock.objects.get_or_create(blocker=request.user, blocked=profile)
        return Response(
            {'success': True, 'blocked': True, 'created': created, 'member_id': str(profile.pk)},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @transaction.atomic
    def delete(self, request, member_id=None):
        if not member_id:
            return Response({'detail': 'member_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = ProfileBlock.objects.filter(blocker=request.user, blocked_id=member_id).delete()
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

        reverse = Interest.objects.select_for_update().filter(
            sender=receiver,
            receiver=request.user,
            status=Interest.Status.PENDING,
        ).first()
        if reverse:
            reverse.status = Interest.Status.ACCEPTED
            reverse.save(update_fields=("status", "updated_at"))
            MatchClosureService.reopen_match(reverse.sender, reverse.receiver)
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
        elif closes_match:
            MatchClosureService.close_match(interest, request.user)
            self._notify_match_removed(interest, request.user)

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
