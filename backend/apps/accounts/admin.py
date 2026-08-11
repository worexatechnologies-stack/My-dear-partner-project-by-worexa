from django.contrib import admin

from .models import (
    Admin,
    AdminPermission,
    AdminRole,
    AdminRolePermission,
    Member,
    MemberDocument,
    MemberPreference,
    MemberProfile,
    Staff,
    SuperAdmin,
)


class AdminRolePermissionInline(admin.TabularInline):
    model = AdminRolePermission
    extra = 0


@admin.register(AdminRole)
class AdminRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_system_role', 'updated_at')
    inlines = (AdminRolePermissionInline,)


@admin.register(AdminPermission)
class AdminPermissionAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'module', 'updated_at')
    list_filter = ('module',)
    search_fields = ('code', 'name')


@admin.register(AdminRolePermission)
class AdminRolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission', 'is_allowed')
    list_filter = ('role', 'is_allowed')


class AccountReadOnlyAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'is_active', 'last_login')
    search_fields = ('email', 'first_name', 'last_name', 'mobile_number')
    readonly_fields = ('password', 'last_login', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        return False


admin.site.register(Member, AccountReadOnlyAdmin)
admin.site.register(SuperAdmin, AccountReadOnlyAdmin)
admin.site.register(Admin, AccountReadOnlyAdmin)
admin.site.register(Staff, AccountReadOnlyAdmin)
admin.site.register(MemberProfile)
admin.site.register(MemberPreference)
admin.site.register(MemberDocument)
