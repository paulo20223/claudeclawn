#!/bin/bash
set -e

cd /opt/app/claudeclaw
git pull
docker compose -f docker-compose.prod.yml up -d --build
