#!/usr/bin/env bash
# Generate an image with OpenAI's gpt-image-2 model.
# Usage: generate.sh "<prompt>" <output-path> [size]
# Reads the API key from ./.openai-key in the current working directory (project root).

set -euo pipefail

PROMPT="${1:-}"
OUTPUT="${2:-}"
SIZE="${3:-1024x1024}"

if [[ -z "$PROMPT" || -z "$OUTPUT" ]]; then
  echo "Usage: generate.sh \"<prompt>\" <output-path> [size]" >&2
  exit 2
fi

if [[ ! -f .openai-key ]]; then
  echo "ERROR: .openai-key not found in $(pwd)." >&2
  echo "Paste your OpenAI API key into a file named .openai-key at the root of your project." >&2
  exit 3
fi

API_KEY="$(tr -d '[:space:]' < .openai-key)"

if [[ -z "$API_KEY" ]]; then
  echo "ERROR: .openai-key is empty. Paste your OpenAI API key into it." >&2
  exit 3
fi

mkdir -p "$(dirname "$OUTPUT")"

RESPONSE="$(curl -sS https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROMPT" --arg s "$SIZE" \
        '{model:"gpt-image-2", prompt:$p, size:$s, n:1}')")"

if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
  echo "OpenAI API error:" >&2
  echo "$RESPONSE" | jq '.error' >&2
  exit 4
fi

B64="$(echo "$RESPONSE" | jq -r '.data[0].b64_json // empty')"
if [[ -n "$B64" ]]; then
  echo "$B64" | base64 -d > "$OUTPUT"
else
  URL="$(echo "$RESPONSE" | jq -r '.data[0].url // empty')"
  if [[ -z "$URL" ]]; then
    echo "ERROR: no b64_json or url in response:" >&2
    echo "$RESPONSE" >&2
    exit 5
  fi
  curl -sSL "$URL" -o "$OUTPUT"
fi

echo "Wrote $OUTPUT"
