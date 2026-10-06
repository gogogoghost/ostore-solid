#!/bin/sh

set -e

if [ -z "${PRIVATE_PEM_PATH:-}" ]; then
    echo "error: set PRIVATE_PEM_PATH to the ED25519 private key (PEM)" >&2
    exit 1
fi

if [ ! -f "$PRIVATE_PEM_PATH" ]; then
    echo "error: $PRIVATE_PEM_PATH does not exist" >&2
    exit 1
fi

if [ ! -f dist/ostore.zip ]; then
    echo "error: dist/ostore.zip not found - run ./build.sh first" >&2
    exit 1
fi

KEY_FILE=$(mktemp)
SIG_FILE=$(mktemp)
trap 'rm -f "$KEY_FILE" "$SIG_FILE"' EXIT

# Normalize the key so a PEM stored in a file, an environment variable or a
# CI secret (CRLF, trailing blank lines, indentation) all behave the same.
tr -d '\r' < "$PRIVATE_PEM_PATH" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' > "$KEY_FILE"
chmod 600 "$KEY_FILE"

key_type=$(openssl pkey -in "$KEY_FILE" -noout -text 2>/dev/null | sed -n '1p' || true)
case "$key_type" in
    ED25519*) ;;
    *)
        echo "error: $PRIVATE_PEM_PATH must hold an ED25519 private key PEM (got '${key_type:-unreadable}')" >&2
        exit 1
        ;;
esac

# -rawin is required to sign a whole file with Ed25519 on OpenSSL 3.0.
openssl pkeyutl -sign -rawin -inkey "$KEY_FILE" -in dist/ostore.zip -out "$SIG_FILE"

curl -sS --fail-with-body -X POST "${PUBLISH_URL:-https://api-ostore.yexm.eu.org/publish}" \
    -F "file=@dist/ostore.zip" \
    -F "sign=@$SIG_FILE" \
    -F "id=ostore"
