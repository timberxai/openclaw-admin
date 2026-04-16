#!/bin/sh
set -e

IMAGE=hermes-admin
DATE_TAG=$(date +%Y.%-m.%-d)

docker build \
  -f Dockerfile.hermes-admin \
  -t "${IMAGE}:latest" \
  -t "${IMAGE}:${DATE_TAG}" \
  .

echo "Built: ${IMAGE}:latest  ${IMAGE}:${DATE_TAG}"
