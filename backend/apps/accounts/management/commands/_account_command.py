import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.rbac import seed_rbac


class CreateAccountCommand(BaseCommand):
    model = None
    role_code = None
    account_label = 'account'

    def add_arguments(self, parser):
        parser.add_argument('--email')
        parser.add_argument('--mobile-number')
        parser.add_argument('--first-name')
        parser.add_argument('--last-name')
        parser.add_argument('--password')
        parser.add_argument('--skip-if-exists', action='store_true', help='Skip if account already exists')

    def extra_values(self, _options):
        return {}

    def value(self, options, option_name, prompt, *, secret=False):
        import os
        import sys
        val = options.get(option_name)
        if val is None:
            env_key = f"SUPERADMIN_{option_name.upper().replace('-', '_')}"
            val = os.environ.get(env_key)
            if val is None and option_name == 'mobile_number':
                val = os.environ.get('SUPERADMIN_MOBILE')
            if val is None and hasattr(sys.stdin, 'isatty') and sys.stdin.isatty():
                val = getpass.getpass(f'{prompt}: ') if secret else input(f'{prompt}: ')
        return str(val).strip() if val is not None else ''

    def handle(self, *args, **options):
        seed_rbac()
        email = self.value(options, 'email', 'Email').lower()
        mobile = self.value(options, 'mobile_number', 'Mobile number')
        first_name = self.value(options, 'first_name', 'First name')
        last_name = self.value(options, 'last_name', 'Last name')
        password = self.value(options, 'password', 'Password', secret=True)
        if not all((email, mobile, first_name, password)):
            raise CommandError('Email, mobile number, first name and password are required.')
        if self.model.objects.filter(email__iexact=email).exists():
            if options.get('skip_if_exists'):
                self.stdout.write(self.style.WARNING(f'A {self.account_label} with email {email} already exists.'))
                return
            raise CommandError(f'A {self.account_label} with this email already exists.')
        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError(' '.join(exc.messages)) from exc
        from apps.accounts.models import AdminRole

        role = AdminRole.objects.get(code=self.role_code)
        account = self.model.objects.create_user(
            email=email,
            mobile_number=mobile,
            first_name=first_name,
            last_name=last_name,
            password=password,
            role=role,
            is_email_verified=True,
            **self.extra_values(options),
        )
        self.stdout.write(self.style.SUCCESS(f'Created {self.account_label}: {account.email}'))
