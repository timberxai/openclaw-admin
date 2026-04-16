#!/bin/bash
# Start hermes gateway (API server + messaging platforms) and dashboard (Web UI)
# in the same container. Gateway runs in background; dashboard runs in foreground
# so the container lifecycle is tied to the dashboard process.

set -e

HERMES=/opt/hermes/.venv/bin/hermes

# Start gateway in background (API server on 8642, Feishu WebSocket, etc.)
"$HERMES" gateway run &
GATEWAY_PID=$!

# Give gateway a moment to bind its port before dashboard tries to connect
sleep 3

# Start dashboard in foreground (Web UI on 9119)
# GATEWAY_HEALTH_URL tells the dashboard where to find the gateway
exec env GATEWAY_HEALTH_URL=http://localhost:8642 \
  "$HERMES" dashboard --host 0.0.0.0 --insecure
