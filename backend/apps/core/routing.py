from django.urls import re_path
from .consumers import ChatConsumer, NotificationConsumer
from apps.accounts.routing import websocket_urlpatterns as accounts_websocket_patterns

websocket_urlpatterns = [
    re_path(r'^ws/chat/(?P<user_id>[0-9a-fA-F-]+)/$', ChatConsumer.as_asgi()),
    re_path(r'^ws/notifications/$', NotificationConsumer.as_asgi()),
] + accounts_websocket_patterns
