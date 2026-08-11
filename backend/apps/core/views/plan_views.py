"""
Membership Plan Views

Public and admin views for membership plan management.
"""

import logging

from rest_framework import status
from rest_framework.views import APIView
from rest_framework import permissions
from rest_framework.response import Response

from apps.core.models import MembershipPlan
from apps.core.responses import ApiResponse
from apps.core.serializers import MembershipPlanSerializer
from apps.accounts.permissions import IsAdmin
from apps.accounts.models import AccountType


logger = logging.getLogger(__name__)


class PublicMembershipPlanListView(APIView):
    """
    GET /api/membership-plans/
    
    Get all active membership plans (public endpoint).
    
    Response:
        {
            "success": true,
            "data": [
                {
                    "id": "uuid",
                    "name": "Free",
                    "slug": "free",
                    "price": "0.00",
                    "duration_days": null,
                    "daily_profile_unlock_limit": 5,
                    "interest_limit": 3,
                    "messaging_mode": "DISABLED",
                    "contact_access_mode": "NONE",
                    "photo_access_mode": "PRIMARY_ONLY",
                    "can_use_advanced_search": false,
                    "is_featured": false,
                    "display_order": 0
                },
                ...
            ]
        }
    """
    
    permission_classes = (permissions.AllowAny,)
    
    def get(self, request):
        plans = MembershipPlan.objects.filter(is_active=True).order_by('display_order')
        serializer = MembershipPlanSerializer(plans, many=True)
        
        return ApiResponse(
            success=True,
            data=serializer.data,
            status=status.HTTP_200_OK
        )


class AdminMembershipPlanListCreateView(APIView):
    """
    GET /api/admin/membership-plans/
    POST /api/admin/membership-plans/
    
    List or create membership plans (admin only).
    """
    
    permission_classes = (permissions.IsAuthenticated, IsAdmin)
    
    def get(self, request):
        plans = MembershipPlan.objects.all().order_by('display_order')
        serializer = MembershipPlanSerializer(plans, many=True)
        
        return ApiResponse(
            success=True,
            data=serializer.data,
            status=status.HTTP_200_OK
        )
    
    def post(self, request):
        """Create a new membership plan"""
        if str(request.user.account_type) != AccountType.SUPER_ADMIN:
            return ApiResponse(success=False, message='Only Super Admin can change membership plans.', status=status.HTTP_403_FORBIDDEN)
        serializer = MembershipPlanSerializer(data=request.data)
        
        if not serializer.is_valid():
            return ApiResponse(
                success=False,
                message='Invalid plan data',
                errors=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        plan = serializer.save()
        
        # Log audit event
        from apps.core.api_utils import audit
        audit(
            request=request,
            actor=request.user,
            action='MEMBERSHIP_PLAN_CREATED',
            module='memberships',
            target_type='MEMBERSHIP_PLAN',
            target_id=plan.pk,
            new_data=serializer.data
        )
        
        return ApiResponse(
            success=True,
            message='Membership plan created successfully',
            data=MembershipPlanSerializer(plan).data,
            status=status.HTTP_201_CREATED
        )


class AdminMembershipPlanDetailView(APIView):
    """
    GET /api/admin/membership-plans/{plan_id}/
    PATCH /api/admin/membership-plans/{plan_id}/
    DELETE /api/admin/membership-plans/{plan_id}/
    
    Retrieve, update, or delete a membership plan (admin only).
    """
    
    permission_classes = (permissions.IsAuthenticated, IsAdmin)
    
    def get(self, request, plan_id):
        try:
            plan = MembershipPlan.objects.get(pk=plan_id)
        except MembershipPlan.DoesNotExist:
            return ApiResponse(
                success=False,
                message='Membership plan not found',
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = MembershipPlanSerializer(plan)
        
        return ApiResponse(
            success=True,
            data=serializer.data,
            status=status.HTTP_200_OK
        )
    
    def patch(self, request, plan_id):
        if str(request.user.account_type) != AccountType.SUPER_ADMIN:
            return ApiResponse(success=False, message='Only Super Admin can change membership plans.', status=status.HTTP_403_FORBIDDEN)
        try:
            plan = MembershipPlan.objects.get(pk=plan_id)
        except MembershipPlan.DoesNotExist:
            return ApiResponse(
                success=False,
                message='Membership plan not found',
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get original data for audit
        original_data = MembershipPlanSerializer(plan).data
        
        serializer = MembershipPlanSerializer(plan, data=request.data, partial=True)
        
        if not serializer.is_valid():
            return ApiResponse(
                success=False,
                message='Invalid plan data',
                errors=serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updated_plan = serializer.save()
        
        # Log audit event
        from apps.core.api_utils import audit
        try:
            audit(
                request=request,
                actor=request.user,
                action='MEMBERSHIP_PLAN_UPDATED',
                module='memberships',
                target_type='MEMBERSHIP_PLAN',
                target_id=plan.pk,
                old_data=original_data,
                new_data=MembershipPlanSerializer(updated_plan).data,
            )
        except Exception:
            # A successful business update must not be reported as failed just
            # because its best-effort audit event cannot be persisted.
            logger.exception('Membership-plan update audit event failed for %s', plan.pk)
        
        return ApiResponse(
            success=True,
            message='Membership plan updated successfully',
            data=MembershipPlanSerializer(updated_plan).data,
            status=status.HTTP_200_OK
        )
    
    def delete(self, request, plan_id):
        if str(request.user.account_type) != AccountType.SUPER_ADMIN:
            return ApiResponse(success=False, message='Only Super Admin can change membership plans.', status=status.HTTP_403_FORBIDDEN)
        try:
            plan = MembershipPlan.objects.get(pk=plan_id)
        except MembershipPlan.DoesNotExist:
            return ApiResponse(
                success=False,
                message='Membership plan not found',
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Store data for audit before deletion
        deleted_data = MembershipPlanSerializer(plan).data
        
        plan_name = plan.name
        plan.delete()
        
        # Log audit event
        from apps.core.api_utils import audit
        audit(
            request=request,
            actor=request.user,
            action='MEMBERSHIP_PLAN_DELETED',
            module='memberships',
            target_type='MEMBERSHIP_PLAN',
            target_id=plan_id,
            old_data=deleted_data
        )
        
        return ApiResponse(
            success=True,
            message=f'Membership plan "{plan_name}" deleted successfully',
            status=status.HTTP_200_OK
        )


class AdminMembershipPlanToggleView(APIView):
    """
    POST /api/admin/membership-plans/{plan_id}/toggle/
    
    Toggle plan active status (super admin only).
    
    Request Body:
        {
            "is_active": true
        }
    """
    
    permission_classes = (permissions.IsAuthenticated, IsAdmin)
    
    def post(self, request, plan_id):
        if str(request.user.account_type) != AccountType.SUPER_ADMIN:
            return ApiResponse(success=False, message='Only Super Admin can change membership plans.', status=status.HTTP_403_FORBIDDEN)
        try:
            plan = MembershipPlan.objects.get(pk=plan_id)
        except MembershipPlan.DoesNotExist:
            return ApiResponse(
                success=False,
                message='Membership plan not found',
                status=status.HTTP_404_NOT_FOUND
            )
        
        is_active = request.data.get('is_active', not plan.is_active)
        original_state = plan.is_active
        
        plan.is_active = is_active
        plan.save(update_fields=['is_active', 'updated_at'])
        
        # Log audit event
        from apps.core.api_utils import audit
        audit(
            request=request,
            actor=request.user,
            action='MEMBERSHIP_PLAN_TOGGLED',
            module='memberships',
            target_type='MEMBERSHIP_PLAN',
            target_id=plan.pk,
            new_data={
                'is_active': is_active,
                'changed_from': original_state,
                'changed_to': is_active
            }
        )
        
        status_text = 'activated' if is_active else 'deactivated'
        
        return ApiResponse(
            success=True,
            message=f'Membership plan "{plan.name}" {status_text}',
            data=MembershipPlanSerializer(plan).data,
            status=status.HTTP_200_OK
        )
