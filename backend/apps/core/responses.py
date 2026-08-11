from rest_framework.response import Response


def _get_request_id(request=None):
    if request and hasattr(request, 'request_id'):
        return request.request_id
    return None


class ApiResponse(Response):
    """
    Standardized success API response envelope:
    {
      "success": true,
      "message": "...",
      "data": {...} | null,
      "errors": null,
      "meta": { "request_id": "uuid" }
    }
    """
    def __init__(self, data=None, message="Request completed successfully.", success=True,
                 errors=None, status=None, request=None, **kwargs):
        request_id = _get_request_id(request)
        payload = {
            'success': success,
            'message': message,
            'data': data,
            'errors': errors,
            'meta': {'request_id': request_id} if request_id else None,
        }
        super().__init__(data=payload, status=status, **kwargs)


class ApiErrorResponse(Response):
    """
    Standardized error response envelope:
    {
      "success": false,
      "message": "...",
      "code": "ERROR_CODE",
      "errors": { ... } | null,
      "meta": { "request_id": "uuid" }
    }
    """
    def __init__(self, message="An error occurred.", code='UNKNOWN_ERROR',
                 errors=None, status=400, request=None, **kwargs):
        request_id = _get_request_id(request)
        payload = {
            'success': False,
            'message': message,
            'code': code,
            'errors': errors or None,
            'meta': {'request_id': request_id} if request_id else None,
        }
        super().__init__(data=payload, status=status, **kwargs)


def ok(data=None, message="Request completed successfully.", request=None):
    return ApiResponse(data=data, message=message, success=True, request=request)


def created(data=None, message="Created successfully.", request=None):
    return ApiResponse(data=data, message=message, success=True, status=201, request=request)


def no_content(request=None):
    return ApiResponse(data=None, message="Deleted successfully.", success=True, status=204, request=request)


def bad_request(message="Please correct the highlighted fields.", errors=None, request=None):
    return ApiErrorResponse(message=message, code='VALIDATION_ERROR', errors=errors, status=400, request=request)


def unauthorized(message="Please sign in again.", request=None):
    return ApiErrorResponse(message=message, code='AUTHENTICATION_REQUIRED', status=401, request=request)


def forbidden(message="You don't have permission to perform this action.", request=None):
    return ApiErrorResponse(message=message, code='PERMISSION_DENIED', status=403, request=request)


def not_found(message="The requested resource could not be found.", request=None):
    return ApiErrorResponse(message=message, code='RESOURCE_NOT_FOUND', status=404, request=request)


def conflict(message="This action conflicts with the current state.", code='CONFLICT', request=None):
    return ApiErrorResponse(message=message, code=code, status=409, request=request)


def too_many_requests(message="Too many attempts. Please try again shortly.", retry_after=None, request=None):
    response = ApiErrorResponse(message=message, code='RATE_LIMITED', status=429, request=request)
    if retry_after:
        response['Retry-After'] = str(retry_after)
    return response


def server_error(message="We couldn't complete your request right now. Please try again.", request=None):
    return ApiErrorResponse(message=message, code='INTERNAL_SERVER_ERROR', status=500, request=request)


def service_unavailable(message="Server is down. Please try again later.", request=None):
    return ApiErrorResponse(message=message, code='SERVICE_UNAVAILABLE', status=503, request=request)
