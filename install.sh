#!/usr/bin/env bash
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"
if ! command -v docker >/dev/null 2>&1; then
  echo 'Installer Docker Engine et le plugin Docker Compose, puis démarrer Docker.' >&2
  exit 1
fi
if [[ "$(docker info --format '{{.OSType}}')" != 'linux' ]]; then
  echo 'Un moteur Docker Linux accessible est nécessaire.' >&2
  exit 1
fi
docker compose version
case "${1:-}" in
  --check) echo 'Prérequis Docker disponibles.'; exit 0 ;;
  '') ;;
  *) echo 'Usage : bash install.sh [--check]' >&2; exit 1 ;;
esac
if [[ ! -f .env ]]; then
  docker run --rm --user "$(id -u):$(id -g)" \
    --mount "type=bind,source=$root,target=/workspace" --workdir /workspace \
    node:24-bookworm-slim node scripts/init-env.mjs
fi
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 300
echo 'AlarMap disponible sur http://localhost:8080/'
echo 'Premier administrateur : suivre docs/MULTI_UTILISATEURS.md.'
