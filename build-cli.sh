#!/bin/sh
set -e

IMAGE=cli
DATE_TAG=$(date +%Y.%-m.%-d)

docker build \
  -f Dockerfile.cli \
  -t "${IMAGE}:latest" \
  -t "${IMAGE}:${DATE_TAG}" \
  .

echo "Built: ${IMAGE}:latest  ${IMAGE}:${DATE_TAG}"
