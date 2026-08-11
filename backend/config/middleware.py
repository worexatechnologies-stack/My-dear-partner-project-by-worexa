"""Small rollout guards that keep paused platform areas unreachable."""

from django.conf import settings
from django.http import HttpResponseNotFound


ADMIN_PATH_PREFIXES = (
    '/django-admin/',
    '/api/v1/admin/',
    '/api/v1/super-admin/',
    '/api/v1/staff/',
    '/api/v1/admin-auth/',
    '/api/v1/super-admin-auth/',
    '/api/v1/staff-auth/',
)


class AdminPortalDisabledMiddleware:
    """Return 404 while the back-office portal is intentionally paused.

    The route definitions and data are retained so setting
    ``ENABLE_ADMIN_PORTAL=true`` restores the portal without a migration or
    code change.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            not getattr(settings, 'ENABLE_ADMIN_PORTAL', False)
            and request.path.startswith(ADMIN_PATH_PREFIXES)
        ):
            return HttpResponseNotFound('Not found.')
        return self.get_response(request)
