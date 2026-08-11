import logging
import traceback
from django.core.exceptions import (
    ValidationError as DjangoValidationError,
    ObjectDoesNotExist,
    MultipleObjectsReturned,
    FieldError,
)
from django.db import (
    IntegrityError,
    DataError,
    DatabaseError,
    OperationalError,
)
from rest_framework.exceptions import (
    APIException,
    ValidationError,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    NotFound,
    MethodNotAllowed,
    ParseError,
    Throttled,
)
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

ERROR_CODES = {
    'ValidationError': 'VALIDATION_ERROR',
    'AuthenticationFailed': 'INVALID_CREDENTIALS',
    'NotAuthenticated': 'AUTHENTICATION_REQUIRED',
    'PermissionDenied': 'PERMISSION_DENIED',
    'NotFound': 'RESOURCE_NOT_FOUND',
    'MethodNotAllowed': 'METHOD_NOT_ALLOWED',
    'ParseError': 'PARSE_ERROR',
    'Throttled': 'RATE_LIMITED',
    'IntegrityError': 'CONFLICT',
    'DataError': 'DATA_ERROR',
    'DatabaseError': 'DATABASE_ERROR',
    'OperationalError': 'SERVICE_UNAVAILABLE',
    'FieldError': 'VALIDATION_ERROR',
    'ObjectDoesNotExist': 'RESOURCE_NOT_FOUND',
    'MultipleObjectsReturned': 'CONFLICT',
    'DjangoValidationError': 'VALIDATION_ERROR',
}

USER_MESSAGES = {
    'VALIDATION_ERROR': 'Please correct the highlighted fields.',
    'INVALID_CREDENTIALS': 'The email/mobile number or password is incorrect.',
    'AUTHENTICATION_REQUIRED': 'Please sign in to continue.',
    'TOKEN_EXPIRED': 'Your session has expired. Please sign in again.',
    'SESSION_EXPIRED': 'Your session has expired. Please sign in again.',
    'SESSION_REVOKED': 'You have been signed out. Please sign in again.',
    'ACCOUNT_SUSPENDED': 'Your account is currently suspended. Please contact support for help.',
    'WRONG_PORTAL': 'Please use the correct login page for your account.',
    'OTP_EXPIRED': 'The verification code has expired. Request a new code.',
    'OTP_INCORRECT': 'The verification code is incorrect.',
    'OTP_RATE_LIMITED': 'Too many attempts. Please wait before trying again.',
    'PERMISSION_DENIED': "You don't have permission to perform this action.",
    'RESOURCE_NOT_FOUND': 'The requested resource could not be found.',
    'MEMBER_NOT_FOUND': 'This member is no longer available.',
    'PHOTO_NOT_FOUND': 'This photo is no longer available.',
    'DOCUMENT_NOT_FOUND': 'This document could not be found.',
    'TICKET_NOT_FOUND': 'This support ticket could not be found.',
    'METHOD_NOT_ALLOWED': 'This action is not supported.',
    'PARSE_ERROR': 'The request could not be parsed.',
    'RATE_LIMITED': 'Too many attempts. Please try again shortly.',
    'CONFLICT': 'This action conflicts with the current state.',
    'DUPLICATE_RECORD': 'This record already exists.',
    'DUPLICATE_EMAIL': 'This email address is already registered.',
    'DUPLICATE_MOBILE': 'This mobile number is already registered.',
    'DUPLICATE_PHOTO': 'This photo has already been uploaded.',
    'ALREADY_APPROVED': 'This request has already been approved.',
    'ALREADY_REJECTED': 'This request has already been rejected.',
    'TICKET_ALREADY_CLAIMED': 'Another support agent has already accepted this ticket.',
    'PRIMARY_PHOTO_NOT_VERIFIED': 'Your primary photo must be approved before adding more photos.',
    'PHOTO_LIMIT_REACHED': 'You have reached the maximum number of profile photos.',
    'MEMBERSHIP_LIMIT_REACHED': 'You have reached the limit allowed by your plan.',
    'INVALID_FILE': 'Please upload a JPEG, PNG, or WebP image.',
    'PROFILE_INCOMPLETE': 'Please complete the required profile details before submitting.',
    'REQUIRED_FIELD_MISSING': 'Please fill in all required fields.',
    'DATA_ERROR': 'The provided data is invalid.',
    'DATABASE_ERROR': 'A database error occurred. Please try again.',
    'SERVICE_UNAVAILABLE': 'Server is down. Please try again later.',
    'GATEWAY_ERROR': 'The server returned an invalid response. Please try again.',
    'REQUEST_TIMEOUT': 'The request took too long. Please try again.',
    'NETWORK_ERROR': "We couldn't connect to the server. Check your internet connection and try again.",
    'UNKNOWN_ERROR': 'Something went wrong. Please try again.',
    'INTERNAL_SERVER_ERROR': "We couldn't complete your request right now. Please try again.",
}

KNOWN_INTEGRITY_PATTERNS = {
    'accounts_member_email_key': ('DUPLICATE_EMAIL', 'This email address is already registered.'),
    'accounts_member_mobile_number_key': ('DUPLICATE_MOBILE', 'This mobile number is already registered.'),
    'profile_photos_member_id_checksum_key': ('DUPLICATE_PHOTO', 'This photo has already been uploaded.'),
}


def get_error_code(exc):
    exc_class = exc.__class__.__name__
    if isinstance(exc, ValidationError):
        if getattr(exc, 'code', None) == 'token_expired':
            return 'TOKEN_EXPIRED'
        return 'VALIDATION_ERROR'
    if isinstance(exc, AuthenticationFailed):
        if getattr(exc, 'code', None) == 'session_expired':
            return 'SESSION_EXPIRED'
        return 'INVALID_CREDENTIALS'
    if isinstance(exc, IntegrityError):
        constraint = _extract_constraint_name(exc)
        if constraint and constraint in KNOWN_INTEGRITY_PATTERNS:
            return KNOWN_INTEGRITY_PATTERNS[constraint][0]
        return 'CONFLICT'
    return ERROR_CODES.get(exc_class, 'INTERNAL_SERVER_ERROR')


def get_user_message(code, exc=None):
    if isinstance(exc, IntegrityError):
        constraint = _extract_constraint_name(exc)
        if constraint and constraint in KNOWN_INTEGRITY_PATTERNS:
            return KNOWN_INTEGRITY_PATTERNS[constraint][1]
    if isinstance(exc, Throttled):
        wait = getattr(exc, 'wait', None)
        if callable(wait):
            seconds = wait()
            if seconds:
                return f'Too many attempts. Please try again in {int(seconds)} seconds.'
    msg = USER_MESSAGES.get(code)
    if msg:
        return msg
    if isinstance(exc, NotFound):
        return 'The requested resource could not be found.'
    if isinstance(exc, PermissionDenied):
        return "You don't have permission to perform this action."
    if isinstance(exc, NotAuthenticated):
        return 'Please sign in to continue.'
    return "We couldn't complete your request right now. Please try again."


def _extract_constraint_name(exc):
    msg = str(exc)
    for keyword in ['unique constraint', 'violates foreign key constraint', 'Key (']:
        if keyword in msg:
            import re
            match = re.search(r'"[^"]+\.([^"]+)"', msg)
            if match:
                return match.group(1)
            match = re.search(r'Key \(([^)]+)\)', msg)
            if match:
                return match.group(1)
    return None


def _get_request_id(context):
    request = context.get('request')
    if request and hasattr(request, 'request_id'):
        return request.request_id
    if request and hasattr(request, 'META'):
        return request.META.get('X-Request-ID')
    return None


def _format_errors(data, exc):
    if data is None:
        return {'detail': [get_user_message('INTERNAL_SERVER_ERROR')]}
    if isinstance(data, list):
        return {'non_field_errors': data}
    if isinstance(data, dict):
        formatted = {}
        for key, value in data.items():
            if isinstance(value, list):
                formatted[key] = [str(v) if not isinstance(v, str) else v for v in value]
            elif isinstance(value, str):
                formatted[key] = [value]
            else:
                formatted[key] = [str(value)]
        return formatted
    return {'detail': [str(data)]}


def custom_exception_handler(exc, context):
    request_id = _get_request_id(context) or 'unknown'
    response = exception_handler(exc, context)

    if response is not None:
        errors = _format_errors(response.data, exc)
        message = get_user_message(get_error_code(exc), exc)
        code = get_error_code(exc)
        response.data = {
            'success': False,
            'message': message,
            'code': code,
            'errors': errors,
            'meta': {'request_id': request_id},
        }
    else:
        if isinstance(exc, IntegrityError):
            code = get_error_code(exc)
            message = get_user_message(code, exc)
            response = Response(
                status=status.HTTP_409_CONFLICT,
                data={
                    'success': False,
                    'message': message,
                    'code': code,
                    'errors': {'detail': [message]},
                    'meta': {'request_id': request_id},
                },
            )
        elif isinstance(exc, (DataError, DatabaseError)):
            logger.error("Database error [%s]: %s", request_id, exc)
            response = Response(
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
                data={
                    'success': False,
                    'message': USER_MESSAGES['SERVICE_UNAVAILABLE'],
                    'code': 'SERVICE_UNAVAILABLE',
                    'errors': None,
                    'meta': {'request_id': request_id},
                },
            )
        elif isinstance(exc, (DjangoValidationError, FieldError)):
            response = Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={
                    'success': False,
                    'message': USER_MESSAGES['VALIDATION_ERROR'],
                    'code': 'VALIDATION_ERROR',
                    'errors': {'detail': exc.messages if hasattr(exc, 'messages') else [str(exc)]},
                    'meta': {'request_id': request_id},
                },
            )
        elif isinstance(exc, (ObjectDoesNotExist, MultipleObjectsReturned)):
            response = Response(
                status=status.HTTP_404_NOT_FOUND,
                data={
                    'success': False,
                    'message': USER_MESSAGES['RESOURCE_NOT_FOUND'],
                    'code': 'RESOURCE_NOT_FOUND',
                    'errors': None,
                    'meta': {'request_id': request_id},
                },
            )
        elif isinstance(exc, OperationalError):
            logger.critical("Operational error [%s]: %s", request_id, exc)
            response = Response(
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
                data={
                    'success': False,
                    'message': USER_MESSAGES['SERVICE_UNAVAILABLE'],
                    'code': 'SERVICE_UNAVAILABLE',
                    'errors': None,
                    'meta': {'request_id': request_id},
                },
            )
        else:
            tb = ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))
            logger.error("Unhandled exception [%s]: %s\n%s", request_id, exc, tb)
            response = Response(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                data={
                    'success': False,
                    'message': USER_MESSAGES['INTERNAL_SERVER_ERROR'],
                    'code': 'INTERNAL_SERVER_ERROR',
                    'errors': None,
                    'meta': {'request_id': request_id},
                },
            )

    return response
