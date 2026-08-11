import uuid
import logging
import time

from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class RequestIDMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request_id = request.META.get('HTTP_X_REQUEST_ID')
        if not request_id:
            request_id = str(uuid.uuid4())
        request.request_id = request_id
        request._request_start_time = time.time()

    def process_response(self, request, response):
        request_id = getattr(request, 'request_id', str(uuid.uuid4()))
        response['X-Request-ID'] = request_id

        duration = None
        start_time = getattr(request, '_request_start_time', None)
        if start_time:
            duration = time.time() - start_time

        account_type = getattr(request.user, 'account_type', None) if hasattr(request, 'user') else None
        user_id = str(request.user.pk) if hasattr(request, 'user') and request.user.is_authenticated else None

        logger.info(
            "[%s] %s %s → %s (%s%.3fs)%s",
            request_id,
            request.method,
            request.path,
            response.status_code,
            f"user={user_id} type={account_type} " if user_id else "",
            duration or 0,
            f" exc={response.get('X-Exception', '')}" if response.get('X-Exception') else "",
        )
        return response

    def process_exception(self, request, exception):
        request_id = getattr(request, 'request_id', 'unknown')
        logger.error("Exception [%s] on %s %s: %s", request_id, request.method, request.path, exception)
