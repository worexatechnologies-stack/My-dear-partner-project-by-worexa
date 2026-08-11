import os
from django.core.wsgi import get_wsgi_application

# Set DJANGO_SETTINGS_MODULE to config.settings.development by default in dev
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

application = get_wsgi_application()
