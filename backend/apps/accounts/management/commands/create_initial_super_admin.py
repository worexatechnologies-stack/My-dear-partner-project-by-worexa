from .create_super_admin import Command as CreateSuperAdminCommand


class Command(CreateSuperAdminCommand):
    help = 'Alias for create_super_admin, intended for the first platform owner.'
