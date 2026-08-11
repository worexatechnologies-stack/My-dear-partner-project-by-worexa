from apps.accounts.models import RoleCode, Staff

from ._account_command import CreateAccountCommand


class Command(CreateAccountCommand):
    help = 'Create a Staff account in the separate staff table.'
    model = Staff
    role_code = RoleCode.STAFF
    account_label = 'Staff'

    def extra_values(self, options):
        return {
            'employee_code': f'STF-{Staff.objects.count() + 1:05d}',
        }
