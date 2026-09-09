from django.urls import path
from .views import DeviceRegistrationView, TestPushNotificationView

urlpatterns = [
    path('devices/', DeviceRegistrationView.as_view(), name='device-registration'),
    path('devices/test-push/', TestPushNotificationView.as_view(), name='device-test-push'),
    path('devices/<str:token>/', DeviceRegistrationView.as_view(), name='device-registration-detail'),
]
