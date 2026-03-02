#!/bin/bash
set -e
mkdir -p /home/claw/.claude/debug
chown -R claw:claw /home/claw/.claude 2>/dev/null || true
chown -R claw:claw /app/.claude 2>/dev/null || true
exec gosu claw "$@"
