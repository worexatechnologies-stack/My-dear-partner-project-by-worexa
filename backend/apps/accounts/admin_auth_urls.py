from django.urls import path

from .views import (
    AdminChangePasswordView,
    AdminLoginView,
    AdminLogoutAllView,
    AdminLogoutView,
    AdminMeView,
    AdminRefreshView,
)

app_name = 'admin_auth'

urlpatterns = [
    path('login/', AdminLoginView.as_view(), name='login'),
    path('logout/', AdminLogoutView.as_view(), name='logout'),
    path('logout-all/', AdminLogoutAllView.as_view(), name='logout_all'),
    path('token/refresh/', AdminRefreshView.as_view(), name='token_refresh'),
    path('me/', AdminMeView.as_view(), name='me'),
    path('change-password/', AdminChangePasswordView.as_view(), name='change_password'),
]
