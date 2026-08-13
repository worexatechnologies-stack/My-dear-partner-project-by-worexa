#!/bin/sh
set -e

if [ "${RUN_DJANGO_MIGRATIONS:-0}" = "1" ]; then
    case "${PROFILE_PHOTO_CUTOVER_PHASE:-final}" in
        stage)
            # Stop before the destructive legacy-table migration. Migration
            # 0004 provides the purge audit action used by the cutover command.
            python manage.py guard_profile_photo_cutover_stage
            python manage.py migrate profiles 0004_profilephotoauditlog_legacy_source_purged --noinput
            python manage.py migrate accounts 0014_migrate_member_photos_to_postgres_bytea --noinput
            ;;
        final)
            python manage.py migrate --noinput
            python manage.py seed_membership_plans
            ;;
        *)
            echo "PROFILE_PHOTO_CUTOVER_PHASE must be 'stage' or 'final'." >&2
            exit 2
            ;;
    esac
fi

if [ "${RUN_SUPERADMIN_SYNC:-1}" = "1" ]; then
    python manage.py sync_super_admin_from_env
fi

if [ "${RUN_DJANGO_COLLECTSTATIC:-0}" = "1" ]; then
    python manage.py collectstatic --noinput
fi

exec "$@"
