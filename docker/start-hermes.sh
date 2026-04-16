#!/bin/bash
# Start hermes gateway (API server on 8642) and dashboard (on internal 9120),
# then Caddy in foreground to TLS-terminate 9119 → dashboard.
#
# Port layout inside container:
#   8642  hermes gateway  (HTTP, mapped to host 20000+)
#   9120  hermes dashboard (HTTP, internal only)
#   9119  Caddy TLS → 9120 (mapped to host 21000+, HTTPS)

set -e

HERMES=/opt/hermes/.venv/bin/hermes

# Start gateway in background (API server on 8642)
"$HERMES" gateway run &
GATEWAY_PID=$!

# Give gateway a moment to bind its port
sleep 3

# Start dashboard in background on internal port 9120 (not exposed directly)
env GATEWAY_HEALTH_URL=http://localhost:8642 \
  "$HERMES" dashboard --host 127.0.0.1 --port 9120 --no-open &

# Give dashboard a moment to start
sleep 2

# Run Caddy in foreground (TLS on 9119 → proxy to dashboard on 9120).
# Container lifecycle is tied to Caddy.
exec caddy run --config /opt/hermes-caddy.Caddyfile
