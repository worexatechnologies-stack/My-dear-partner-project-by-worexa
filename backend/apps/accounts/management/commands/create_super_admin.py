from apps.accounts.models import RoleCode, SuperAdmin

from ._account_command import CreateAccountCommand


class Command(CreateAccountCommand):
    help = 'Create a Super Admin in the separate super_admins table.'
    model = SuperAdmin
    role_code = RoleCode.SUPER_ADMIN
    account_label = 'Super Admin'
