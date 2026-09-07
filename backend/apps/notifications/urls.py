from django.urls import path
from .views import DeviceRegistrationView

urlpatterns = [
    path('devices/', DeviceRegistrationView.as_view(), name='device-registration'),
    path('devices/<str:token>/', DeviceRegistrationView.as_view(), name='device-registration-detail'),
]
