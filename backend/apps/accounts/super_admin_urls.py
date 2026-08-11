from django.urls import path

from .views import (
    SuperAdminChangePasswordView,
    SuperAdminLoginView,
    SuperAdminLogoutAllView,
    SuperAdminLogoutView,
    SuperAdminMeView,
    SuperAdminRefreshView,
)

app_name = 'super_admin_auth'

urlpatterns = [
    path('login/', SuperAdminLoginView.as_view(), name='login'),
    path('logout/', SuperAdminLogoutView.as_view(), name='logout'),
    path('logout-all/', SuperAdminLogoutAllView.as_view(), name='logout_all'),
    path('token/refresh/', SuperAdminRefreshView.as_view(), name='token_refresh'),
    path('me/', SuperAdminMeView.as_view(), name='me'),
    path('change-password/', SuperAdminChangePasswordView.as_view(), name='change_password'),
]
