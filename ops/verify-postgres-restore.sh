#!/usr/bin/env bash
#
# Restore one encrypted logical backup into an isolated disposable database and
# prove that the ProfilePhoto BYTEA table and Django migration history exist.
# This is a verification tool, not a production recovery command.

set -Eeuo pipefail
umask 077

: "${BACKUP_FILE:?Set BACKUP_FILE to a postgres-*.dump.age file}"
: "${BACKUP_AGE_IDENTITY_FILE:?Set BACKUP_AGE_IDENTITY_FILE to an age identity file}"
: "${RESTORE_PGHOST:?Set RESTORE_PGHOST to an isolated restore PostgreSQL server}"
: "${RESTORE_PGUSER:?Set RESTORE_PGUSER}"

RESTORE_PGPORT="${RESTORE_PGPORT:-5432}"
RESTORE_DB_NAME="${RESTORE_DB_NAME:-restore_verify_$(date -u +%Y%m%d)}"
RESTORE_REPLACE="${RESTORE_REPLACE:-0}"

for command in age createdb dropdb pg_restore psql sha256sum; do
    command -v "$command" >/dev/null 2>&1 || {
        echo "Missing required command: $command" >&2
        exit 1
    }
done

[[ "$RESTORE_DB_NAME" =~ ^restore_verify_[a-z0-9_]+$ ]] || {
    echo "RESTORE_DB_NAME must begin with restore_verify_ to prevent production use." >&2
    exit 1
}
[[ -f "$BACKUP_FILE" && -f "$BACKUP_AGE_IDENTITY_FILE" ]] || {
    echo "The encrypted backup and age identity file must exist." >&2
    exit 1
}

work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT
dump_file="$work_dir/restore.dump"

if [[ -f "${BACKUP_FILE}.sha256" ]]; then
    (cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "${BACKUP_FILE}.sha256")")
fi

age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" --output "$dump_file" "$BACKUP_FILE"
pg_restore --list "$dump_file" >/dev/null

db_args=(--host="$RESTORE_PGHOST" --port="$RESTORE_PGPORT" --username="$RESTORE_PGUSER")
if psql "${db_args[@]}" --dbname=postgres --tuples-only --no-align --quiet \
    -c "SELECT 1 FROM pg_database WHERE datname = '${RESTORE_DB_NAME}';" | grep -qx '1'; then
    if [[ "$RESTORE_REPLACE" != "1" ]]; then
        echo "Verification database ${RESTORE_DB_NAME} exists; set RESTORE_REPLACE=1 to replace this disposable database." >&2
        exit 1
    fi
    dropdb "${db_args[@]}" "$RESTORE_DB_NAME"
fi

createdb "${db_args[@]}" "$RESTORE_DB_NAME"
pg_restore "${db_args[@]}" --dbname="$RESTORE_DB_NAME" --exit-on-error --no-owner --no-privileges "$dump_file"

psql "${db_args[@]}" --dbname="$RESTORE_DB_NAME" --set=ON_ERROR_STOP=1 <<'SQL'
SELECT count(*) AS applied_migrations FROM django_migrations;
SELECT count(*) AS profile_photo_rows,
       coalesce(sum(octet_length(image_data)), 0) AS main_image_bytes,
       coalesce(sum(octet_length(thumbnail_data)), 0) AS thumbnail_bytes
FROM profile_photos;
SQL

echo "Restore verification passed in ${RESTORE_DB_NAME}. Drop this isolated database after recording the result."
