#!/bin/bash
set -e
chown -R claw:claw /app/.claude 2>/dev/null || true
exec gosu claw "$@"
