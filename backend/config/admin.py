from django.contrib.admin import AdminSite
from django.contrib.admin.apps import AdminConfig
from django.conf import settings


class SuperAdminSite(AdminSite):
    """Django's built-in admin is reserved for active SUPER_ADMIN accounts."""

    site_header = 'My Dear Partner Super Administration'
    site_title = 'My Dear Partner Super Admin'
    index_title = 'System administration'

    def has_permission(self, request):
        if not getattr(settings, 'ENABLE_ADMIN_PORTAL', False):
            return False
        user = request.user
        return bool(
            user.is_authenticated
            and user.is_active
            and getattr(user, 'is_super_admin', False)
            and getattr(user, 'can_access_admin', False)
        )


class SuperAdminConfig(AdminConfig):
    default_site = 'config.admin.SuperAdminSite'
