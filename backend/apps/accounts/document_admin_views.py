from rest_framework import permissions, status
from rest_framework.views import APIView
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.conf import settings

from .models import Member, MemberDocument, AccountType
from .permissions import HasAdminPermission, IsAdministrativeUser, IsSuperAdmin
from .serializers import AdminDocumentSerializer
from apps.core.responses import ApiResponse
from apps.core.api_utils import create_notification, audit as _audit, client_ip


def _notify_member(document, notification_type, title, message):
    try:
        create_notification(
            document.member,
            type=notification_type,
            title=title,
            body=message,
            related_object=document,
        )
    except Exception:
        pass


class AdminDocumentListView(APIView):
    permission_classes = (permissions.IsAuthenticated, HasAdminPermission)
    required_admin_permission = 'documents.view'

    def get(self, request):
        from django.core.paginator import Paginator
        from django.db.models import Q

        queryset = MemberDocument.objects.select_related('member').defer('file_data').order_by('-uploaded_at')

        status_filter = request.query_params.get('status')
        doc_type = request.query_params.get('document_type')
        member_id = request.query_params.get('member_id')
        search = request.query_params.get('search')

        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if doc_type:
            queryset = queryset.filter(document_type__iexact=doc_type)
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        if search:
            queryset = queryset.filter(
                Q(member__first_name__icontains=search) |
                Q(member__last_name__icontains=search) |
                Q(member__email__icontains=search)
            )

        page_size = int(request.query_params.get('page_size', 25))
        page_number = int(request.query_params.get('page', 1))
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page_number)

        serializer = AdminDocumentSerializer(page_obj, many=True)

        return ApiResponse(data={
            'items': serializer.data,
            'pagination': {
                'page': page_obj.number,
                'page_size': page_size,
                'total_pages': paginator.num_pages,
                'total_items': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
            }
        }, status=status.HTTP_200_OK)


class AdminDocumentDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated, HasAdminPermission)
    required_admin_permission = 'documents.view'

    def get(self, request, document_id):
        try:
            doc = MemberDocument.objects.select_related('member').get(pk=document_id)
        except MemberDocument.DoesNotExist:
            return ApiResponse(success=False, message='Document not found.', status=status.HTTP_404_NOT_FOUND)

        serializer = AdminDocumentSerializer(doc)
        return ApiResponse(data=serializer.data, status=status.HTTP_200_OK)


class AdminDocumentDownloadView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdministrativeUser)

    def get(self, request, document_id):
        try:
            doc = MemberDocument.objects.get(pk=document_id)
        except MemberDocument.DoesNotExist:
            return ApiResponse(success=False, message='Document not found.', status=status.HTTP_404_NOT_FOUND)

        has_perm = (
            request.user.account_type == AccountType.SUPER_ADMIN or
            request.user.has_admin_permission('documents.download') or
            request.user.has_admin_permission('documents.view')
        )
        if not has_perm:
            return ApiResponse(success=False, message='Access denied.', status=status.HTTP_403_FORBIDDEN)

        if not doc.file_data:
            return ApiResponse(success=False, message='Document file not found.', status=status.HTTP_404_NOT_FOUND)

        try:
            raw_bytes = doc.raw_file_bytes
            if raw_bytes is None:
                raise ValueError('Decompression failed')
            response = HttpResponse(raw_bytes, content_type=doc.mime_type or 'application/octet-stream')
            safe_filename = doc.original_file_name.replace('"', '').replace('\\', '').replace('/', '')
            response['Content-Disposition'] = f'attachment; filename="{safe_filename}"'
            response['Content-Length'] = doc.file_size
            response['X-Content-Type-Options'] = 'nosniff'
            response['Cache-Control'] = 'private, no-cache'
            return response
        except Exception:
            return ApiResponse(success=False, message='Error reading document file.', status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminDocumentPreviewView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdministrativeUser)

    def get(self, request, document_id):
        try:
            doc = MemberDocument.objects.get(pk=document_id)
        except MemberDocument.DoesNotExist:
            return ApiResponse(success=False, message='Document not found.', status=status.HTTP_404_NOT_FOUND)

        has_perm = (
            request.user.account_type == AccountType.SUPER_ADMIN or
            request.user.has_admin_permission('documents.view') or
            request.user.has_admin_permission('documents.download')
        )
        if not has_perm:
            return ApiResponse(success=False, message='Access denied.', status=status.HTTP_403_FORBIDDEN)

        if not doc.file_data:
            return ApiResponse(success=False, message='Document file not found.', status=status.HTTP_404_NOT_FOUND)

        try:
            raw_bytes = doc.raw_file_bytes
            if raw_bytes is None:
                raise ValueError('Decompression failed')
            response = HttpResponse(raw_bytes, content_type=doc.mime_type or 'application/octet-stream')
            safe_filename = doc.original_file_name.replace('"', '').replace('\\', '').replace('/', '')
            response['Content-Disposition'] = f'inline; filename="{safe_filename}"'
            response['Content-Length'] = doc.file_size
            response['X-Content-Type-Options'] = 'nosniff'
            response['Cache-Control'] = 'private, no-cache'
            return response
        except Exception:
            return ApiResponse(success=False, message='Error reading document file.', status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminDocumentApproveView(APIView):
    permission_classes = (permissions.IsAuthenticated, HasAdminPermission)
    required_admin_permission = 'documents.approve'

    def post(self, request, document_id):
        try:
            doc = MemberDocument.objects.select_related('member').get(pk=document_id)
        except MemberDocument.DoesNotExist:
            return ApiResponse(success=False, message='Document not found.', status=status.HTTP_404_NOT_FOUND)

        if doc.status != MemberDocument.Status.PENDING:
            return ApiResponse(
                success=False,
                message=f'Only pending documents can be approved. Current status: {doc.status}',
                status=status.HTTP_400_BAD_REQUEST,
            )

        reviewer = request.user
        admin_comment = request.data.get('comment', '').strip()

        with transaction.atomic():
            doc.status = MemberDocument.Status.APPROVED
            doc.reviewed_at = timezone.now()
            doc.reviewed_by_id = reviewer.pk
            doc.rejection_reason = ''
            if admin_comment:
                doc.admin_comment = admin_comment
            doc.save()

            # Keep the member-level document status in sync. Other document
            # approval paths (verification queue, core admin actions) set
            # member.document_status, but this admin-panel path previously
            # did not, leaving the member's verification centre stuck on
            # "draft" even after the document was approved.
            member = doc.member
            member.document_status = Member.VerificationStatus.APPROVED
            member.document_reviewed_at = timezone.now()
            member.document_rejection_reason = ''
            member.save(
                update_fields=[
                    'document_status',
                    'document_reviewed_at',
                    'document_rejection_reason',
                    'updated_at',
                ]
            )

            _log_audit(request, request.user, 'DOCUMENT_APPROVED', doc, old_status='PENDING', new_status=doc.status)

            _notify_member(
                doc, 'document_approved',
                'Document Approved',
                f'Your {doc.display_name} has been approved.',
            )

        serializer = AdminDocumentSerializer(doc)
        return ApiResponse(
            success=True,
            message='Document approved and member notified.',
            data={'document': serializer.data},
            status=status.HTTP_200_OK,
        )


class AdminDocumentRejectView(APIView):
    permission_classes = (permissions.IsAuthenticated, HasAdminPermission)
    required_admin_permission = 'documents.reject'

    def post(self, request, document_id):
        try:
            doc = MemberDocument.objects.select_related('member').get(pk=document_id)
        except MemberDocument.DoesNotExist:
            return ApiResponse(success=False, message='Document not found.', status=status.HTTP_404_NOT_FOUND)

        if doc.status != MemberDocument.Status.PENDING:
            return ApiResponse(
                success=False,
                message=f'Only pending documents can be rejected. Current status: {doc.status}',
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', '').strip()
        if not reason:
            return ApiResponse(
                success=False,
                message='Rejection reason is required.',
                status=status.HTTP_400_BAD_REQUEST,
            )

        reviewer = request.user
        admin_comment = request.data.get('comment', '').strip()

        with transaction.atomic():
            doc.status = MemberDocument.Status.REJECTED
            doc.reviewed_at = timezone.now()
            doc.reviewed_by_id = reviewer.pk
            doc.rejection_reason = reason
            if admin_comment:
                doc.admin_comment = admin_comment
            doc.save()

            # Keep the member-level document status in sync (mirrors the
            # verification-queue reject path).
            member = doc.member
            member.document_status = Member.VerificationStatus.REJECTED
            member.document_reviewed_at = timezone.now()
            member.document_rejection_reason = reason
            member.save(
                update_fields=[
                    'document_status',
                    'document_reviewed_at',
                    'document_rejection_reason',
                    'updated_at',
                ]
            )

            _log_audit(request, request.user, 'DOCUMENT_REJECTED', doc, old_status='PENDING', new_status=doc.status, reason=reason)

            _notify_member(
                doc, 'document_rejected',
                'Document Rejected',
                f'Your {doc.display_name} was rejected.\n\nReason: {reason}\n\nPlease upload a clear copy.',
            )

        serializer = AdminDocumentSerializer(doc)
        return ApiResponse(
            success=True,
            message='Document rejected and member notified.',
            data={'document': serializer.data},
            status=status.HTTP_200_OK,
        )


def _log_audit(request, actor, action, document, old_status=None, new_status=None, reason=''):
    _audit(
        request, actor,
        action=action,
        module='documents',
        target_type='MEMBER_DOCUMENT',
        target_id=document.pk,
        description=f'Document {document.document_type} {action.lower()} for member {document.member_id}',
        old_data={'status': old_status} if old_status else {},
        new_data={'status': new_status, 'reason': reason} if new_status else {'reason': reason},
    )
