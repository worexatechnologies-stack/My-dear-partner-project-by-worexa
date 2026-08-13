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
            # JWT middleware must be the layer that sets the final scope user.
            # Wrapping it outside AuthMiddlewareStack allows the session layer
            # to replace a valid JWT user with AnonymousUser before consumers
            # run, which makes production WebSocket connections look broken.
            JwtAuthMiddleware(URLRouter(websocket_urlpatterns))
        ),
    }
)
