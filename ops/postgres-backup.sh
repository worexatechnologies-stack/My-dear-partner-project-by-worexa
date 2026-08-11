#!/usr/bin/env bash
#
# Create an encrypted PostgreSQL logical backup, verify it, copy it off-site,
# and retain the dedicated backup prefix for BACKUP_RETENTION_DAYS days.
#
# This script is intentionally deployment-agnostic: run it from a locked-down
# backup runner that has pg_dump/pg_restore, age, rclone and network access to
# PostgreSQL plus the configured off-site backup prefix.

set -Eeuo pipefail
umask 077

: "${PGHOST:?Set PGHOST for the PostgreSQL primary}"
: "${PGDATABASE:?Set PGDATABASE}"
: "${PGUSER:?Set PGUSER}"
: "${BACKUP_LOCAL_DIR:?Set BACKUP_LOCAL_DIR to a dedicated local backup directory}"
: "${BACKUP_REMOTE_URL:?Set BACKUP_REMOTE_URL to a dedicated rclone prefix}"
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to the production age public key}"

PGPORT="${PGPORT:-5432}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_WARN_PERCENT="${BACKUP_WARN_PERCENT:-70}"
BACKUP_HIGH_PERCENT="${BACKUP_HIGH_PERCENT:-80}"
BACKUP_CRITICAL_PERCENT="${BACKUP_CRITICAL_PERCENT:-85}"
BACKUP_SPACE_MULTIPLIER="${BACKUP_SPACE_MULTIPLIER:-3}"
BACKUP_MIN_FREE_BYTES="${BACKUP_MIN_FREE_BYTES:-5368709120}"
BACKUP_DATABASE_DISK_PATH="${BACKUP_DATABASE_DISK_PATH:-$BACKUP_LOCAL_DIR}"
BACKUP_ALERT_WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK_URL:-}"
BACKUP_PRUNE_REMOTE="${BACKUP_PRUNE_REMOTE:-1}"

for command in age cp df find pg_dump pg_restore psql rclone sha256sum; do
    command -v "$command" >/dev/null 2>&1 || {
        echo "Missing required command: $command" >&2
        exit 1
    }
done

if ! [[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || ! [[ "$BACKUP_WARN_PERCENT" =~ ^[1-9][0-9]*$ ]] || ! [[ "$BACKUP_HIGH_PERCENT" =~ ^[1-9][0-9]*$ ]] || ! [[ "$BACKUP_CRITICAL_PERCENT" =~ ^[1-9][0-9]*$ ]] || ! [[ "$BACKUP_SPACE_MULTIPLIER" =~ ^[1-9][0-9]*$ ]] || ! [[ "$BACKUP_MIN_FREE_BYTES" =~ ^[0-9]+$ ]]; then
    echo "Retention and disk thresholds must be positive integers." >&2
    exit 1
fi

if (( BACKUP_WARN_PERCENT >= BACKUP_HIGH_PERCENT || BACKUP_HIGH_PERCENT >= BACKUP_CRITICAL_PERCENT || BACKUP_CRITICAL_PERCENT > 100 )); then
    echo "Disk thresholds must satisfy 0 < warning < high < critical <= 100." >&2
    exit 1
fi

mkdir -p -- "$BACKUP_LOCAL_DIR"
BACKUP_LOCAL_DIR="$(cd -- "$BACKUP_LOCAL_DIR" && pwd -P)"
case "$BACKUP_LOCAL_DIR" in
    /|/tmp|/var|/home|/root)
        echo "BACKUP_LOCAL_DIR must be a dedicated directory, not $BACKUP_LOCAL_DIR." >&2
        exit 1
        ;;
esac

notify() {
    local severity="$1"
    local message="$2"
    printf '%s [%s] %s\n' "$(date -u +%FT%TZ)" "$severity" "$message" >&2

    # Any HTTPS endpoint that accepts a small JSON event can be used (for
    # example, an alerting gateway).  Do not put the webhook in source control.
    if [[ -n "$BACKUP_ALERT_WEBHOOK_URL" ]] && command -v curl >/dev/null 2>&1; then
        curl --fail --silent --show-error --max-time 15 \
            -H 'Content-Type: application/json' \
            -d "{\"service\":\"matiromony-postgres-backup\",\"severity\":\"${severity}\",\"message\":\"${message}\"}" \
            "$BACKUP_ALERT_WEBHOOK_URL" >/dev/null || true
    fi
}

disk_percent() {
    df -P "$1" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }'
}

check_disk() {
    local label="$1"
    local path="$2"
    local used
    if ! used="$(disk_percent "$path")"; then
        notify critical "Unable to determine ${label} disk utilisation."
        return 1
    fi
    [[ "$used" =~ ^[0-9]+$ ]] || {
        notify critical "Unable to determine ${label} disk utilisation."
        return 1
    }

    if (( used >= BACKUP_CRITICAL_PERCENT )); then
        notify critical "${label} disk utilisation is ${used}% (critical threshold ${BACKUP_CRITICAL_PERCENT}%)."
        return 1
    fi
    if (( used >= BACKUP_HIGH_PERCENT )); then
        notify high "${label} disk utilisation is ${used}% (high threshold ${BACKUP_HIGH_PERCENT}%)."
        return 0
    fi
    if (( used >= BACKUP_WARN_PERCENT )); then
        notify warning "${label} disk utilisation is ${used}% (warning threshold ${BACKUP_WARN_PERCENT}%)."
    fi
}

check_disk "backup" "$BACKUP_LOCAL_DIR"
check_disk "database" "$BACKUP_DATABASE_DISK_PATH"

# Estimate space before pg_dump creates any large file. During the handoff the
# backup filesystem can contain the custom dump, its encrypted copy, and the
# retained encrypted copy simultaneously. Keep at least the 85% emergency
# headroom (or BACKUP_MIN_FREE_BYTES, whichever is larger) after that peak.
database_bytes="$(psql --no-align --tuples-only --quiet \
    --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="$PGDATABASE" \
    -c 'SELECT pg_database_size(current_database());' | tr -d '[:space:]')"
[[ "$database_bytes" =~ ^[0-9]+$ ]] || {
    notify critical "Could not read pg_database_size before backup."
    exit 1
}

read -r backup_total_kib backup_available_kib < <(
    df -Pk "$BACKUP_LOCAL_DIR" | awk 'NR == 2 { print $2, $4 }'
)
[[ "$backup_total_kib" =~ ^[0-9]+$ && "$backup_available_kib" =~ ^[0-9]+$ ]] || {
    notify critical "Could not determine absolute backup filesystem capacity."
    exit 1
}
backup_total_bytes=$((backup_total_kib * 1024))
backup_available_bytes=$((backup_available_kib * 1024))
critical_headroom_bytes=$((backup_total_bytes * (100 - BACKUP_CRITICAL_PERCENT) / 100))
if (( critical_headroom_bytes < BACKUP_MIN_FREE_BYTES )); then
    critical_headroom_bytes=$BACKUP_MIN_FREE_BYTES
fi
required_available_bytes=$((database_bytes * BACKUP_SPACE_MULTIPLIER + critical_headroom_bytes))
if (( backup_available_bytes < required_available_bytes )); then
    notify critical "Insufficient backup space: ${backup_available_bytes} bytes available; ${required_available_bytes} required for peak files and emergency headroom."
    exit 1
fi

lock_dir="$BACKUP_LOCAL_DIR/.postgres-backup.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
    notify warning "A PostgreSQL backup is already running; skipping this invocation."
    exit 0
fi

work_dir="$(mktemp -d "$BACKUP_LOCAL_DIR/.postgres-backup.XXXXXX")"
cleanup() {
    local status=$?
    rm -rf -- "$work_dir"
    rmdir "$lock_dir" 2>/dev/null || true
    if (( status != 0 )); then
        notify critical "PostgreSQL backup failed; the previous verified off-site backup is unchanged."
    fi
    exit "$status"
}
trap cleanup EXIT

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive_name="postgres-${PGDATABASE}-${timestamp}.dump"
dump_file="$work_dir/$archive_name"
encrypted_file="$work_dir/${archive_name}.age"
checksum_file="$work_dir/${archive_name}.age.sha256"
manifest_file="$work_dir/${archive_name}.manifest.json"
local_encrypted_file="$BACKUP_LOCAL_DIR/$(basename "$encrypted_file")"
local_checksum_file="$BACKUP_LOCAL_DIR/$(basename "$checksum_file")"
local_manifest_file="$BACKUP_LOCAL_DIR/$(basename "$manifest_file")"

# Custom format includes all table data, including BYTEA profile-photo columns.
pg_dump --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
    --format=custom --compress=9 --no-owner --no-privileges \
    --file="$dump_file" "$PGDATABASE"
pg_restore --list "$dump_file" >/dev/null

age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted_file" "$dump_file"
(cd "$work_dir" && sha256sum "$(basename "$encrypted_file")") > "$checksum_file"
printf '{"created_at":"%s","database":"%s","database_bytes":%s,"archive":"%s","format":"pg_dump-custom+age","verified":"pg_restore --list"}\n' \
    "$(date -u +%FT%TZ)" "$PGDATABASE" "$database_bytes" "$(basename "$encrypted_file")" > "$manifest_file"

# Retain only encrypted local copies. Then copy (never sync) to avoid deleting
# an off-site backup because of a local failure. The manifest is copied last.
cp -- "$encrypted_file" "$local_encrypted_file"
cp -- "$checksum_file" "$local_checksum_file"
cp -- "$manifest_file" "$local_manifest_file"
rclone copyto "$local_encrypted_file" "$BACKUP_REMOTE_URL/$(basename "$local_encrypted_file")"
rclone copyto "$local_checksum_file" "$BACKUP_REMOTE_URL/$(basename "$local_checksum_file")"
rclone copyto "$local_manifest_file" "$BACKUP_REMOTE_URL/$(basename "$local_manifest_file")"

# Keep remote storage credentials scoped to a single dedicated prefix.  Object
# lock/versioning and a 30-day lifecycle rule must also be configured remotely.
if [[ "$BACKUP_PRUNE_REMOTE" == "1" ]]; then
    rclone delete "$BACKUP_REMOTE_URL" --min-age "${BACKUP_RETENTION_DAYS}d" \
        --include 'postgres-*.dump.age' \
        --include 'postgres-*.dump.age.sha256' \
        --include 'postgres-*.dump.manifest.json'
fi
find "$BACKUP_LOCAL_DIR" -maxdepth 1 -type f \
    \( -name 'postgres-*.dump.age' -o -name 'postgres-*.dump.age.sha256' -o -name 'postgres-*.dump.manifest.json' \) \
    -mtime "+${BACKUP_RETENTION_DAYS}" -delete

notify info "PostgreSQL backup verified, encrypted, and copied off-site (${database_bytes} database bytes)."
