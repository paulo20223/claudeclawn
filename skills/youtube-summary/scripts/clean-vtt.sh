#!/usr/bin/env bash
# Cleans a VTT subtitle file to plain text.
# Usage: clean-vtt.sh <path-to-vtt>
# Removes timestamps, WEBVTT headers, metadata, deduplicates auto-sub repeats.

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: clean-vtt.sh <path-to-vtt>" >&2
  exit 1
fi

file="$1"

if [ ! -f "$file" ]; then
  echo "Error: file not found: $file" >&2
  exit 1
fi

# 1. Strip WEBVTT header, Kind/Language metadata, NOTE blocks, timestamps, blank lines
# 2. Remove HTML-like tags (e.g. <c>, </c>, <00:00:01.234>)
# 3. Deduplicate identical lines (common in auto-generated subs)
# 4. Join into a single text block, collapse whitespace
grep -v -E '^WEBVTT|^Kind:|^Language:|^NOTE|^[0-9]{2}:[0-9]{2}|^$' "$file" \
  | sed 's/<[^>]*>//g' \
  | awk '!seen[$0]++' \
  | tr '\n' ' ' \
  | sed 's/  */ /g; s/^ //; s/ $//'
echo
