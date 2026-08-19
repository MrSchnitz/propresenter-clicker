#!/bin/bash
cd "$(dirname "$0")"
export SETTINGS_FILE="$HOME/Library/Application Support/ProPresenter Clicker/settings.json"
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2)
PORT=${PORT:-3000}
(sleep 2 && open "http://localhost:$PORT") &
NODE_ENV=production npx tsx server/index.ts
