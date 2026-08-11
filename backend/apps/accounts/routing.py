"""
WebSocket URL routing for accounts app
"""

from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/verification/', consumers.VerificationConsumer.as_asgi()),
]