from django.contrib import admin
from .models import MemberPass, MemberShortlist


@admin.register(MemberPass)
class MemberPassAdmin(admin.ModelAdmin):
    list_display = ('user', 'profile', 'created_at')
    search_fields = (
        'user__email',
        'user__first_name',
        'user__last_name',
        'profile__member__email',
        'profile__member__first_name',
        'profile__member__last_name',
    )
    list_filter = ('created_at',)
    date_hierarchy = 'created_at'
    raw_id_fields = ('user', 'profile')


@admin.register(MemberShortlist)
class MemberShortlistAdmin(admin.ModelAdmin):
    list_display = ('user', 'profile', 'created_at')
    search_fields = (
        'user__email',
        'user__first_name',
        'user__last_name',
        'profile__member__email',
        'profile__member__first_name',
        'profile__member__last_name',
    )
    list_filter = ('created_at',)
    date_hierarchy = 'created_at'
    raw_id_fields = ('user', 'profile')
