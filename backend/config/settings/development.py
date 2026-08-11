from .base import *

# Development settings override
DEBUG = True
ALLOWED_HOSTS = ['*']

# Keep account verification relaxed locally, but never bypass profile-photo moderation.
# This makes development behave like production for the member-visible photo flow.
REQUIRE_MEMBER_VERIFICATION = False
AUTO_APPROVE_PROFILE_PHOTOS = False

# Fallback to local in-memory Cache and Channels when Redis is not running/needed locally
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'matiromony-development-cache',
    }
}

# Automatically use RedisChannelLayer when Redis is active/reachable, else fallback to InMemoryChannelLayer
try:
    import socket
    import urllib.parse
    r_url = urllib.parse.urlparse(config.get('REDIS_URL', 'redis://localhost:6379/0'))
    r_host = r_url.hostname or 'localhost'
    r_port = r_url.port or 6379

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    redis_active = (sock.connect_ex((r_host, int(r_port))) == 0)
    sock.close()

    if redis_active:
        CACHES = {
            'default': {
                'BACKEND': 'django.core.cache.backends.redis.RedisCache',
                'LOCATION': f'redis://{r_host}:{r_port}/0',
            }
        }
        CHANNEL_LAYERS = {
            'default': {
                'BACKEND': 'channels_redis.core.RedisChannelLayer',
                'CONFIG': {
                    'hosts': [(r_host, int(r_port))],
                },
            },
        }
    else:
        CHANNEL_LAYERS = {
            'default': {
                'BACKEND': 'channels.layers.InMemoryChannelLayer',
            },
        }
except Exception:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }

