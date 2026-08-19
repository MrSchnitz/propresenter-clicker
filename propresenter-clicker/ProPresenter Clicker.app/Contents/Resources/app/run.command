#!/bin/bash
cd "$(dirname "$0")"
export SETTINGS_FILE="$HOME/Library/Application Support/ProPresenter Clicker/settings.json"
# Port: .env default, overridden by an appPort saved from the admin panel.
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2)
if [ -f "$SETTINGS_FILE" ]; then
  SAVED=$(sed -n 's/.*"appPort"[[:space:]]*:[[:space:]]*"\([0-9]*\)".*/\1/p' "$SETTINGS_FILE")
  [ -n "$SAVED" ] && PORT=$SAVED
fi
PORT=${PORT:-3000}
(sleep 2 && open "http://localhost:$PORT") &
NODE_ENV=production npx tsx server/index.ts
