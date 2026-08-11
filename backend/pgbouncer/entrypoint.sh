#!/bin/sh
# Validate runtime-only PgBouncer input before delegating to the image's
# configuration generator. This wrapper writes an ephemeral userlist, so no
# database credential is committed or mounted from the host.
set -eu

require_safe_identifier() {
    value="$1"
    label="$2"

    case "$value" in
        ''|*[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-]*)
            echo "PgBouncer ${label} contains unsupported characters." >&2
            exit 64
            ;;
    esac
}

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

require_safe_identifier "$DB_HOST" "database host"
require_safe_identifier "$DB_NAME" "database name"
require_safe_identifier "$DB_USER" "database user"

case "$DB_PORT" in
    ''|*[!0123456789]*)
        echo "PgBouncer DB_PORT must be numeric." >&2
        exit 64
        ;;
esac

if printf '%s' "$DB_PASSWORD" | grep -q '[[:cntrl:]]'; then
    echo "PgBouncer DB_PASSWORD cannot contain control characters." >&2
    exit 64
fi

# Keep the generated config and user list owner-readable only in the
# container's ephemeral filesystem.  PgBouncer escapes a literal quote in an
# auth-file field by doubling it; writing the entry here avoids relying on the
# upstream convenience generator's unescaped shell interpolation.
umask 077
escaped_password=$(printf '%s' "$DB_PASSWORD" | sed 's/"/""/g')
printf '"%s" "%s"\n' "$DB_USER" "$escaped_password" > /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt
exec /entrypoint.sh "$@"
