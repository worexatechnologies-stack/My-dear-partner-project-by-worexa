from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from django.shortcuts import redirect
from django.http import HttpResponseNotFound, JsonResponse

def custom_page_not_found(request, exception=None):
    if request.path.startswith('/api/'):
        return JsonResponse({
            'success': False,
            'message': 'The requested endpoint was not found.',
            'data': None,
            'errors': {
                'detail': 'Resource not found.'
            }
        }, status=404)
    from django.views.defaults import page_not_found
    return page_not_found(request, exception)

def custom_server_error(request):
    if request.path.startswith('/api/'):
        return JsonResponse({
            'success': False,
            'message': 'A server error occurred. Please try again later.',
            'data': None,
            'errors': {
                'detail': 'Internal server error.'
            }
        }, status=500)
    from django.views.defaults import server_error
    return server_error(request)

handler404 = 'config.urls.custom_page_not_found'
handler500 = 'config.urls.custom_server_error'

urlpatterns = [
    path('', lambda request: redirect('api/docs/', permanent=False)),
    path('django-admin/', admin.site.urls),

    # Direct-response API contract for standalone matrimony clients.  The
    # existing /api/v1 routes intentionally remain unchanged below.
    path('member-auth/', include('apps.accounts.contract_urls')),
    path('', include('apps.matching.urls')),

    # Canonical private profile-photo API.  It is intentionally separate from
    # normal JSON/profile routes because it returns authenticated raw WebP
    # bytes from PostgreSQL BYTEA columns.
    path('api/', include(('apps.profiles.urls', 'profiles'), namespace='profiles-api')),
    
    # API Endpoints version 1
    path('api/v1/', include(('apps.profiles.urls', 'profiles'), namespace='profiles-v1')),
    path('api/v1/auth/', include(('apps.accounts.urls', 'accounts'), namespace='auth-v1')),
    path('api/v1/member-auth/', include('apps.accounts.urls')),
    path('api/auth/', include(('apps.accounts.urls', 'accounts'), namespace='auth-root')),
    path('api/v1/super-admin-auth/', include('apps.accounts.super_admin_urls')),
    path('api/v1/admin-auth/', include('apps.accounts.admin_auth_urls')),
    path('api/v1/', include('apps.core.urls')),

    # Messaging endpoints
    path('api/v1/member-auth/', include('apps.messaging.urls')),
    # The legacy frontend is mounted at /api/v1 and needs shortlists while it
    # transitions away from its former browser mock client.
    path('api/v1/', include('apps.matching.urls')),
    
    # OpenAPI Schema & Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    # Legacy profile originals awaiting the guarded BYTEA cutover must never
    # become public merely because runserver serves other development media.
    urlpatterns += [
        path(
            'media/member_photos/<path:legacy_path>',
            lambda request, legacy_path: HttpResponseNotFound(),
        ),
    ]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
