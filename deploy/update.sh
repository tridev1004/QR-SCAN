#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi

npm ci
npm run build -w backend
npm run build -w frontend
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
