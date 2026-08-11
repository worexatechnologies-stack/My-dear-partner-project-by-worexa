from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Member, MemberProfile
from apps.core.models import Interest
from apps.profiles.models import ProfilePhoto
from apps.profiles.serializers import MemberProfileDetailSerializer

from .models import MemberShortlist
from .serializers import MemberInterestSerializer


class ShortlistView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        rows = (
            MemberShortlist.objects.filter(user=request.user)
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
        )
        return Response(MemberInterestSerializer(queryset, many=True, context={"request": request}).data)

    @transaction.atomic
    def post(self, request):
        receiver_id = request.data.get("receiver_id")
        receiver = get_object_or_404(
            Member.objects.filter(is_active=True, deleted_at__isnull=True),
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
            return Response(MemberInterestSerializer(reverse, context={"request": request}).data)

        existing = Interest.objects.select_for_update().filter(
            sender=request.user,
            receiver=receiver,
        ).first()
        if existing:
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
