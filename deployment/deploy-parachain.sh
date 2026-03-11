#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[deploy] starting PolkaSend integrated stack"
echo "[deploy] root: ${ROOT_DIR}"

if command -v docker >/dev/null 2>&1 && command -v docker compose >/dev/null 2>&1; then
  docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d backend frontend
  echo "[deploy] frontend + backend started"
  echo "[deploy] to include chain services, run:"
  echo "         docker compose -f ${ROOT_DIR}/docker-compose.yml --profile chain up -d"
else
  echo "[deploy] docker or docker compose not found"
  exit 1
fi
