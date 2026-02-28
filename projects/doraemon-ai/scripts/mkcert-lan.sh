#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$PROJECT_ROOT/certs"

LAN_IP="${LAN_IP:-}"
if [[ -z "$LAN_IP" ]]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi
if [[ -z "$LAN_IP" ]]; then
  LAN_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi

LOCAL_HOSTNAME="$(scutil --get LocalHostName 2>/dev/null || true)"
if [[ -n "$LOCAL_HOSTNAME" ]]; then
  LOCAL_DOT_LOCAL="${LOCAL_HOSTNAME}.local"
else
  LOCAL_DOT_LOCAL=""
fi

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert not found."
  echo "Install: brew install mkcert"
  exit 1
fi

mkdir -p "$CERT_DIR"

echo "Installing mkcert local CA into macOS Keychain (idempotent)..."
mkcert -install >/dev/null

CERT_PEM="$CERT_DIR/lan-dev.pem"
KEY_PEM="$CERT_DIR/lan-dev-key.pem"

echo "Generating LAN cert for:"
echo "  - localhost, 127.0.0.1, ::1"
if [[ -n "$LAN_IP" ]]; then
  echo "  - $LAN_IP"
else
  echo "  - (no LAN IP detected; set LAN_IP=... to include one)"
fi
if [[ -n "$LOCAL_DOT_LOCAL" ]]; then
  echo "  - $LOCAL_DOT_LOCAL"
fi

ARGS=(localhost 127.0.0.1 ::1)
if [[ -n "$LAN_IP" ]]; then
  ARGS+=("$LAN_IP")
fi
if [[ -n "$LOCAL_DOT_LOCAL" ]]; then
  ARGS+=("$LOCAL_DOT_LOCAL")
fi

mkcert -cert-file "$CERT_PEM" -key-file "$KEY_PEM" "${ARGS[@]}" >/dev/null

CAROOT="$(mkcert -CAROOT)"
ROOT_PEM="$CAROOT/rootCA.pem"
ROOT_CER="$CERT_DIR/mkcert-rootCA.cer"

if [[ ! -f "$ROOT_PEM" ]]; then
  echo "ERROR: mkcert rootCA.pem not found at: $ROOT_PEM"
  exit 1
fi

echo "Exporting mkcert root CA for iOS install:"
openssl x509 -in "$ROOT_PEM" -out "$ROOT_CER" -outform DER

echo ""
echo "Done."
echo "Vite will use:"
echo "  - $CERT_PEM"
echo "  - $KEY_PEM"
echo ""
echo "For iPhone (one-time): AirDrop this to your iPhone and install+trust it:"
echo "  - $ROOT_CER"
echo ""
if [[ -n "$LAN_IP" ]]; then
  echo "Then open on iPhone:"
  echo "  https://$LAN_IP:5173/"
fi

