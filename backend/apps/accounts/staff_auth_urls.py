from django.urls import path

from .views import (
    StaffChangePasswordView,
    StaffLoginView,
    StaffLogoutAllView,
    StaffLogoutView,
    StaffMeView,
    StaffRefreshView,
)

app_name = 'staff_auth'

urlpatterns = [
    path('login/', StaffLoginView.as_view(), name='login'),
    path('logout/', StaffLogoutView.as_view(), name='logout'),
    path('logout-all/', StaffLogoutAllView.as_view(), name='logout_all'),
    path('token/refresh/', StaffRefreshView.as_view(), name='token_refresh'),
    path('me/', StaffMeView.as_view(), name='me'),
    path('change-password/', StaffChangePasswordView.as_view(), name='change_password'),
]
