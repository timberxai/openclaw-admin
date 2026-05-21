#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# 拉取最新 multica 镜像并打上日期 tag，供 closeclaw GlobalConfig 填写。
#
# 用法：
#   ./deploy-multica.sh              # 拉 latest，tag 为今天日期（如 2026.5.21）
#   ./deploy-multica.sh 2026.5.20    # 拉 latest，tag 为指定版本
#
# 执行后输出：
#   multica-backend:2026.5.21
#   → 复制到 closeclaw GlobalConfig "Multica Image" 字段即可
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

TAG="${1:-$(date +%Y.%-m.%-d)}"

REGISTRY_BACKEND="ghcr.io/multica-ai/multica-backend:latest"
REGISTRY_WEB="ghcr.io/multica-ai/multica-web:latest"

LOCAL_BACKEND="multica-backend:${TAG}"
LOCAL_WEB="multica-web:${TAG}"

echo "=== Pulling latest multica images ==="
docker pull "${REGISTRY_BACKEND}"
docker pull "${REGISTRY_WEB}"

echo ""
echo "=== Tagging locally ==="
docker tag "${REGISTRY_BACKEND}" "${LOCAL_BACKEND}"
docker tag "${REGISTRY_WEB}" "${LOCAL_WEB}"

echo "  ${LOCAL_BACKEND}"
echo "  ${LOCAL_WEB}"

echo ""
echo "=== Done ==="
echo ""
echo "Paste into closeclaw GlobalConfig 'Multica Image':"
echo ""
echo "  ${LOCAL_BACKEND}"
echo ""
