from rest_framework import status
from rest_framework.views import APIView
from rest_framework import permissions

from apps.accounts.permissions import IsMember
from apps.core.responses import ApiResponse, ApiErrorResponse
from apps.core.services.membership_lifecycle_service import MembershipLifecycleService
from apps.core.services.membership_service import MembershipService
from apps.core.models import MemberMembership


class MembershipUpgradeView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def post(self, request):
        plan_slug = request.data.get('plan_slug', '').strip().lower()
        if not plan_slug:
            return ApiErrorResponse(code='PLAN_REQUIRED', message='plan_slug is required.', status=status.HTTP_400_BAD_REQUEST)

        current_slug = MembershipLifecycleService.get_current_plan_slug(request.user)
        
        # Strict upgrade-only validation
        if current_slug and not MembershipLifecycleService.is_valid_upgrade(current_slug, plan_slug):
            return ApiErrorResponse(
                code='UPGRADE_ONLY_POLICY', 
                message='You can only upgrade to a higher-tier plan. Downgrades are not allowed.',
                status=status.HTTP_400_BAD_REQUEST
            )

        activation_mode = MembershipService.get_activation_mode()
        if activation_mode == MembershipService.ACTIVATION_MODE_INSTANT:
            success, message, _ = MembershipService.activate_plan(request.user, plan_slug, source='member_request')
        else:
            from apps.core.membership_activation_service import MembershipActivationService
            result = MembershipActivationService.select_plan_verified(request.user, plan_slug, source='member_request')
            success, message = result.success, result.message

        if not success:
            return ApiResponse(success=False, message=message, status=status.HTTP_400_BAD_REQUEST)
        return ApiResponse(success=True, message=message)


class AvailableUpgradesView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def get(self, request):
        upgrades = MembershipLifecycleService.get_available_upgrades(request.user)
        return ApiResponse(data={'plans': upgrades})


class ActivateFreePlanView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def post(self, request):
        # Strict upgrade-only policy - no downgrades to free plan allowed
        return ApiErrorResponse(
            code='DOWNGRADE_NOT_ALLOWED',
            message='Downgrades to free plan are not allowed. Contact support to cancel your membership.',
            status=status.HTTP_400_BAD_REQUEST
        )


class CancelMembershipView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def post(self, request):
        # Strict upgrade-only policy - no self-service cancellation allowed
        return ApiErrorResponse(
            code='SELF_CANCEL_NOT_ALLOWED', 
            message='Self-service cancellation is not available. Please contact support to cancel your membership.',
            status=status.HTTP_400_BAD_REQUEST
        )


class MembershipStatusDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsMember)

    def get(self, request):
        summary = MembershipService.get_membership_summary(request.user)
        current_slug = MembershipLifecycleService.get_current_plan_slug(request.user)
        upgrades = MembershipLifecycleService.get_available_upgrades(request.user)

        return ApiResponse(data={
            'summary': summary,
            'current_plan_slug': current_slug,
            'available_upgrades': upgrades,
        })
