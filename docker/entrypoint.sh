#!/bin/sh
# Start openclaw-admin in the background
(cd /opt/openclaw-admin && PORT="${ADMIN_PORT:-3000}" HOST=0.0.0.0 npx tsx server/index.ts) &

# Run the main command (openclaw gateway) from /app
cd /app
exec "$@"
