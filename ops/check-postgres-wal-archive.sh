#!/usr/bin/env bash
# Check PostgreSQL's continuous-WAL archive health. Run this from monitoring
# after configuring pgBackRest, WAL-G, or another tested archive_command.

set -Eeuo pipefail

: "${PGHOST:?Set PGHOST for the PostgreSQL primary}"
: "${PGDATABASE:?Set PGDATABASE}"
: "${PGUSER:?Set PGUSER}"

PGPORT="${PGPORT:-5432}"
WAL_ARCHIVE_MAX_AGE_MINUTES="${WAL_ARCHIVE_MAX_AGE_MINUTES:-20}"

[[ "$WAL_ARCHIVE_MAX_AGE_MINUTES" =~ ^[1-9][0-9]*$ ]] || {
    echo "WAL_ARCHIVE_MAX_AGE_MINUTES must be a positive integer." >&2
    exit 1
}

command -v psql >/dev/null 2>&1 || {
    echo "Missing required command: psql" >&2
    exit 1
}

result="$(psql --no-align --field-separator='|' --tuples-only --quiet \
    --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="$PGDATABASE" \
    --set=ON_ERROR_STOP=1 \
    -c "SELECT current_setting('archive_mode'), archived_count, failed_count,
               coalesce(floor(extract(epoch FROM (clock_timestamp() - last_archived_time)) / 60)::text, 'never'),
               CASE WHEN last_failed_time IS NOT NULL
                          AND (last_archived_time IS NULL OR last_failed_time > last_archived_time)
                    THEN '1' ELSE '0' END
        FROM pg_stat_archiver;")"
result="$(printf '%s' "$result" | tr -d '[:space:]')"
IFS='|' read -r archive_mode archived_count failed_count archive_age latest_attempt_failed <<< "$result"

if [[ "$archive_mode" != "on" && "$archive_mode" != "always" ]]; then
    echo "WAL archive check failed: archive_mode is ${archive_mode:-unknown}." >&2
    exit 1
fi
if ! [[ "$archived_count" =~ ^[0-9]+$ && "$failed_count" =~ ^[0-9]+$ ]]; then
    echo "WAL archive check failed: invalid pg_stat_archiver response." >&2
    exit 1
fi
if [[ "$latest_attempt_failed" != "0" ]]; then
    echo "WAL archive check failed: the latest archive attempt failed (${failed_count} cumulative failures)." >&2
    exit 1
fi
if [[ "$archive_age" == "never" ]] || ! [[ "$archive_age" =~ ^[0-9]+$ ]] || (( archive_age > WAL_ARCHIVE_MAX_AGE_MINUTES )); then
    echo "WAL archive check failed: last archived WAL is ${archive_age} minutes old." >&2
    exit 1
fi

echo "WAL archive healthy: ${archived_count} archived files; latest ${archive_age} minutes ago."
