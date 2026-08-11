from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
from django.urls import re_path

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

django_asgi_app = get_asgi_application()

from apps.notifications.middleware import JwtAuthMiddleware
from apps.notifications.routing import websocket_urlpatterns as notifications_patterns
from apps.core.consumers import ChatConsumer

websocket_urlpatterns = (
    notifications_patterns
    + [
        re_path(
            r"^ws/chat/(?P<user_id>[0-9a-fA-F-]+)/$",
            ChatConsumer.as_asgi(),
        ),
    ]
)

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JwtAuthMiddleware(
                AuthMiddlewareStack(
                    URLRouter(websocket_urlpatterns)
                )
            )
        ),
    }
)
