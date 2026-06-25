#!/bin/bash
set -e

# Export container environment variables to /etc/profile.d so all login shells
# inherit them (`docker exec -it ... bash -l` sources /etc/profile, not .bashrc).
write_export() {
    local name="$1"
    local value="${!name:-}"
    printf 'export %s=%q\n' "$name" "$value"
}

{
    echo "# Docker environment variables"
    # claude-code auths to non-anthropic gateways via ANTHROPIC_AUTH_TOKEN
    # (Bearer); ANTHROPIC_API_KEY would force the TUI onto api.anthropic.com.
    write_export ANTHROPIC_AUTH_TOKEN
    write_export ANTHROPIC_BASE_URL
    write_export ANTHROPIC_MODEL
    write_export OPENAI_API_KEY
    write_export OPENAI_BASE_URL
    write_export CODEX_MODEL
    write_export CODEX_MODEL_REASONING_EFFORT
    write_export CODEX_BASE_URL
    write_export API_TIMEOUT_MS
    write_export TERM
    write_export DISABLE_AUTOUPDATER
    write_export CLAUDE_CODE_DOCKER
    write_export UV_CACHE_DIR
    echo 'export PATH="/root/.local/bin:$PATH"'
    echo "cd /workspace"
} > /etc/profile.d/agent-env.sh

mkdir -p /root/.codex
if [ ! -f /root/.codex/config.toml ]; then
    cat > /root/.codex/config.toml <<EOF
model = "${CODEX_MODEL:-gpt-5.5}"
model_reasoning_effort = "${CODEX_MODEL_REASONING_EFFORT:-high}"
personality = "pragmatic"
model_provider = "litellm"
cli_auth_credentials_store = "file"

[model_providers.litellm]
name = "LiteLLM"
base_url = "${CODEX_BASE_URL:-https://litellm.ym1.yuanmu-ai.com/v1}"
wire_api = "responses"
env_key = "OPENAI_API_KEY"
supports_websockets = false

[projects."/workspace"]
trust_level = "trusted"
EOF
elif ! grep -q '^cli_auth_credentials_store[[:space:]]*=' /root/.codex/config.toml; then
    {
        echo ''
        echo '# Store Codex auth data in ~/.codex instead of an OS keyring.'
        echo 'cli_auth_credentials_store = "file"'
    } >> /root/.codex/config.toml
fi

# Make /workspace a git repo so `codex exec` runs without --skip-git-repo-check.
# /workspace is a bind-mounted volume owned by root, which git flags as "dubious
# ownership"; mark it safe first. Idempotent: skip if already a repo.
git config --global --add safe.directory /workspace
if ! git -C /workspace rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C /workspace init -q
    git -C /workspace config user.email "cli@local"
    git -C /workspace config user.name "cli"
fi

# Auto-start the lark-channel-bridge (feishu <-> claude/codex) if it's been
# paired. The QR pairing writes /root/.lark-channel/config.json, which lives on
# a mounted volume and survives recreate; the container has no systemd, so we
# supervise it here. No config = not paired yet => skip (other cli services and
# the first-run `lark-channel-bridge run` scan are unaffected).
if command -v lark-channel-bridge >/dev/null 2>&1 && [ -f /root/.lark-channel/config.json ]; then
    # Clear stale process registry/locks. The lock holder is tracked by PID on
    # the mounted volume, but PIDs are per-container — after a recreate the old
    # PID is gone yet the lock persists, so bridge wrongly reports "profile
    # already in use" and refuses to start. At container boot no bridge runs in
    # THIS container, so any registry entry is a leftover and safe to purge.
    rm -rf /root/.lark-channel/registry/locks/* /root/.lark-channel/registry/processes.json 2>/dev/null || true
    # Point each profile's default workspace at /workspace (mounted, persistent,
    # a git repo). Bridge's own default is /root/.lark-channel-workspaces/<p>/default,
    # which isn't on any volume and isn't created — agents then fail with
    # "工作目录不存在或不可访问". Only rewrite that bridge-managed default; a
    # user's own /cd target is left untouched.
    python3 - <<'PYEOF' || true
import json
p = "/root/.lark-channel/config.json"
try:
    d = json.load(open(p))
except Exception:
    raise SystemExit(0)
changed = False
for name, prof in (d.get("profiles") or {}).items():
    ws = prof.setdefault("workspaces", {})
    cur = ws.get("default", "")
    if cur != "/workspace" and (not cur or "/.lark-channel-workspaces/" in cur):
        ws["default"] = "/workspace"
        changed = True
        print(f"[lark-bridge] profile {name}: default workspace -> /workspace")
if changed:
    json.dump(d, open(p, "w"), ensure_ascii=False, indent=2)
PYEOF
    echo "[lark-bridge] paired config found — starting supervised bridge in background"
    # Supervise: a bare `run` isn't restarted if it crashes/exits, and the
    # container has no systemd. Loop with backoff; purge the stale lock each
    # round (this container's previous bridge instance may have left one).
    (
      while true; do
        rm -rf /root/.lark-channel/registry/locks/* /root/.lark-channel/registry/processes.json 2>/dev/null || true
        echo "[lark-bridge] $(date -u +%FT%TZ) starting bridge run" >> /root/.lark-channel/bridge.log
        lark-channel-bridge run >> /root/.lark-channel/bridge.log 2>&1
        echo "[lark-bridge] $(date -u +%FT%TZ) bridge exited ($?), restarting in 5s" >> /root/.lark-channel/bridge.log
        sleep 5
      done
    ) &
else
    echo "[lark-bridge] not paired (no /root/.lark-channel/config.json) — skipping"
fi

echo "============================================"
echo " cli container is running (claude / codex)"
echo "============================================"
echo ""
echo " Access: docker exec -it <container> bash"
echo " Then run: claude or codex"
echo " Python tools: python3, pip3, uv, uvx"
echo "============================================"

# Keep container alive (exec-only; backend exec's claude/codex on demand)
exec tail -f /dev/null
