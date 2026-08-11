from apps.accounts.models import Admin, RoleCode

from ._account_command import CreateAccountCommand


class Command(CreateAccountCommand):
    help = 'Create an Admin in the separate admins table.'
    model = Admin
    role_code = RoleCode.ADMIN
    account_label = 'Admin'
