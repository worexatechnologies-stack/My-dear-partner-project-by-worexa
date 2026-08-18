#!/bin/sh
set -eu

tls_mode="${NGINX_TLS_MODE:-strict}"
server_name="${NGINX_TLS_SERVER_NAME:-mydearpartner.in}"
source_certificate="/etc/letsencrypt/live/${server_name}/fullchain.pem"
source_key="/etc/letsencrypt/live/${server_name}/privkey.pem"
target_directory="/etc/nginx/tls"

mkdir -p "$target_directory"

if [ -r "$source_certificate" ] && [ -r "$source_key" ]; then
    cp "$source_certificate" "$target_directory/fullchain.pem"
    cp "$source_key" "$target_directory/privkey.pem"
    chmod 600 "$target_directory/privkey.pem"
    echo "Using the mounted TLS certificate for ${server_name}."
elif [ "$tls_mode" = "local" ]; then
    # Local mode stays encrypted without requiring production certificate files.
    openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 7 \
        -keyout "$target_directory/privkey.pem" \
        -out "$target_directory/fullchain.pem" \
        -subj "/CN=${server_name}" \
        -addext "subjectAltName=DNS:${server_name},DNS:localhost,IP:127.0.0.1"
    chmod 600 "$target_directory/privkey.pem"
    echo "Using a short-lived self-signed TLS certificate for local development."
else
    echo "TLS certificate files are missing for ${server_name}; set NGINX_TLS_MODE=local only for local development." >&2
    exit 1
fi

exec "$@"
