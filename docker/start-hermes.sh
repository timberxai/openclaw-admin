#!/bin/bash
# Start hermes gateway in foreground. Container lifecycle tied to gateway.
# The chat UI runs in the hermes-web-ui sidecar; this container only needs
# the gateway on 8642 (mapped to host gateway_port by closeclaw).
set -e

exec /opt/hermes/.venv/bin/hermes gateway run
