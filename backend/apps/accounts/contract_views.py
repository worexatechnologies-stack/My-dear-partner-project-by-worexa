from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.memberships.serializers import MembershipSubscriptionSerializer
from apps.memberships.services import active_subscription_for
from apps.profiles.serializers import MemberProfileDetailSerializer

from .contract_serializers import (
    ContractLoginSerializer,
    ContractRegistrationSerializer,
    ContractUserSerializer,
)
from .security import issue_account_tokens


class ContractRegisterView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (AnonRateThrottle,)

    @transaction.atomic
    def post(self, request):
        serializer = ContractRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = issue_account_tokens(user)["access"]
        return Response(
            {"token": token, "user": ContractUserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class ContractLoginView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (AnonRateThrottle,)

    def post(self, request):
        serializer = ContractLoginSerializer(data=request.data)
        if not serializer.is_valid():
            if "non_field_errors" in serializer.errors:
                return Response(
                    {"detail": "Invalid credentials."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            raise ValidationError(serializer.errors)
        user = serializer.validated_data["user"]
        token = issue_account_tokens(user)["access"]
        return Response({"token": token, "user": ContractUserSerializer(user).data})


class ContractMeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        payload = ContractUserSerializer(request.user).data
        payload["profile"] = MemberProfileDetailSerializer(
            request.user,
            context={"request": request},
        ).data
        subscription = active_subscription_for(request.user)
        payload["active_subscription"] = (
            MembershipSubscriptionSerializer(subscription).data if subscription else None
        )
        return Response(payload)
