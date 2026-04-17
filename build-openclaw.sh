#!/bin/sh
set -e

IMAGE=openclaw-admin
DATE_TAG=$(date +%Y.%-m.%-d)

docker build \
  -f Dockerfile \
  -t "${IMAGE}:latest" \
  -t "${IMAGE}:${DATE_TAG}" \
  .

echo "Built: ${IMAGE}:latest  ${IMAGE}:${DATE_TAG}"
