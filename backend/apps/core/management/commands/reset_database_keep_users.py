"""Safely reset business data while retaining an explicitly named account set.

This command deliberately has no implicit production guard: it is intended for
the one-off reset described in the operational runbook.  It is nevertheless
safe-by-default: it only reports its plan unless ``--execute`` is supplied and
requires exactly four unambiguous account identifiers.
"""

from collections import defaultdict
from uuid import UUID

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction
from django.db.models import ProtectedError

from apps.accounts.models import (
    Admin,
    Member,
    MemberProfile,
    Staff,
    SuperAdmin,
)


ACCOUNT_MODELS = (Member, SuperAdmin, Admin, Staff)


class Command(BaseCommand):
    help = (
        'Delete all database rows except four explicitly supplied accounts and '
        'MemberProfile rows directly owned by retained members. Defaults to a dry run.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'identifiers',
            nargs=4,
            help='Exactly four account UUIDs or email addresses to retain.',
        )
        parser.add_argument(
            '--execute',
            action='store_true',
            help='Perform the reset. Omit for a dry-run report.',
        )

    def handle(self, *args, **options):
        retained = self._resolve_accounts(options['identifiers'])
        retained_by_model = defaultdict(set)
        for account in retained:
            retained_by_model[account.__class__].add(account.pk)

        # MemberProfile is the only user-owned data retained. Every other
        # business record -- including payments, tickets, chats, photos,
        # documents, verification requests, memberships, notifications,
        # duplicate flags, and audit logs -- is intentionally deleted.
        retained_by_model[MemberProfile].update(
            MemberProfile.objects.filter(member_id__in=retained_by_model[Member]).values_list('pk', flat=True)
        )
        models = self._managed_models()
        delete_counts = self._delete_counts(models, retained_by_model)

        self.stdout.write('Retained rows:')
        for account in retained:
            self.stdout.write(f'  - {account.__class__.__name__}: {account.email} ({account.pk})')
        self.stdout.write(
            '  - MemberProfile: profiles directly owned by retained Member accounts only'
        )
        self.stdout.write(
            'Discarded data: memberships, payments, tickets, chats, photos, documents, '
            'verification requests, notifications, duplicate flags, audit logs, and every '
            'other non-retained table row.'
        )
        self.stdout.write('Rows to delete by table:')
        for model in models:
            count = delete_counts[model]
            if count:
                self.stdout.write(f'  {model._meta.db_table}: {count}')

        if not options['execute']:
            self.stdout.write(self.style.WARNING('Dry run complete. Re-run with --execute to delete rows.'))
            return

        with transaction.atomic():
            self._clear_references_from_retained_rows(models, retained_by_model)
            self._delete_models(models, retained_by_model)
            self._reset_sequences(models)
            self._verify(models, retained_by_model)

        self.stdout.write(self.style.SUCCESS('Database reset completed and verified.'))

    def _resolve_accounts(self, identifiers):
        accounts = []
        seen = set()
        for identifier in identifiers:
            matches = []
            try:
                value = UUID(identifier)
                for model in ACCOUNT_MODELS:
                    matches.extend(model.objects.filter(pk=value))
            except (ValueError, TypeError):
                for model in ACCOUNT_MODELS:
                    matches.extend(model.objects.filter(email__iexact=identifier.strip()))
            if not matches:
                raise CommandError(f'No account matches "{identifier}".')
            if len(matches) != 1:
                labels = ', '.join(f'{item.__class__.__name__}:{item.pk}' for item in matches)
                raise CommandError(f'"{identifier}" is ambiguous; use an account UUID instead ({labels}).')
            account = matches[0]
            identity = (account.__class__, account.pk)
            if identity in seen:
                raise CommandError(f'"{identifier}" resolves to an account already supplied.')
            seen.add(identity)
            accounts.append(account)
        return accounts

    @staticmethod
    def _managed_models():
        return [
            model
            for model in apps.get_models(include_auto_created=False)
            if model._meta.managed and not model._meta.proxy and model._meta.db_table
        ]

    @staticmethod
    def _delete_counts(models, retained_by_model):
        counts = {}
        for model in models:
            queryset = model.objects.all()
            retained_pks = retained_by_model.get(model)
            if retained_pks:
                queryset = queryset.exclude(pk__in=retained_pks)
            counts[model] = queryset.count()
        return counts

    def _clear_references_from_retained_rows(self, models, retained_by_model):
        """Clear nullable FKs from kept rows to rows that will be removed.

        This permits retaining an Admin/Staff account while removing its role
        or other reference row. A required reference is a hard
        error rather than silently retaining extra data outside the agreed set.
        """
        deleted_models = set(models) - set(retained_by_model)
        for model, retained_pks in retained_by_model.items():
            for field in model._meta.fields:
                if not field.is_relation or not field.many_to_one:
                    continue
                if field.remote_field.model not in deleted_models:
                    continue
                queryset = model.objects.filter(pk__in=retained_pks).exclude(**{f'{field.name}__isnull': True})
                if not queryset.exists():
                    continue
                if not field.null:
                    raise CommandError(
                        f'Cannot retain {model._meta.label} rows because required relation '
                        f'{field.name} points to rows scheduled for deletion.'
                    )
                queryset.update(**{field.name: None})

    @staticmethod
    def _queryset_to_delete(model, retained_by_model):
        queryset = model.objects.all()
        retained_pks = retained_by_model.get(model)
        if retained_pks:
            queryset = queryset.exclude(pk__in=retained_pks)
        return queryset

    def _delete_models(self, models, retained_by_model):
        # Foreign-key graphs differ across deployments. Repeated passes let
        # Django's deletion collector clear leaf rows first; the transaction
        # rolls everything back if a protected cycle cannot be resolved.
        pending = list(reversed(models))
        while pending:
            next_pending = []
            deleted_any = False
            blockers = []
            for model in pending:
                queryset = self._queryset_to_delete(model, retained_by_model)
                if not queryset.exists():
                    continue
                try:
                    queryset.delete()
                    deleted_any = True
                except ProtectedError as error:
                    next_pending.append(model)
                    blockers.append(f'{model._meta.label}: {error}')
            if not next_pending:
                return
            if not deleted_any:
                raise CommandError(
                    'Unable to delete all rows because of protected references: ' + '; '.join(blockers)
                )
            pending = next_pending

    @staticmethod
    def _reset_sequences(models):
        # UUID-primary-key tables generate no database sequence. Backends that
        # do use sequences receive Django's backend-specific reset SQL.
        with connection.cursor() as cursor:
            for sql in connection.ops.sequence_reset_sql(no_style(), models):
                cursor.execute(sql)

    def _verify(self, models, retained_by_model):
        account_count = sum(model.objects.count() for model in ACCOUNT_MODELS)
        if account_count != 4:
            raise CommandError(f'Expected exactly four accounts after reset, found {account_count}.')
        remaining = []
        for model in models:
            expected = len(retained_by_model.get(model, set()))
            actual = model.objects.count()
            if actual != expected:
                remaining.append(f'{model._meta.db_table}: expected {expected}, found {actual}')
        if remaining:
            raise CommandError('Reset verification failed: ' + '; '.join(remaining))
