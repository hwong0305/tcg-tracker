#!/bin/sh
set -e

cd /app

bun install

ATTEMPTS=0
MAX_ATTEMPTS=30

until bunx drizzle-kit push --config packages/data/drizzle.config.ts; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "Failed to apply migrations after ${MAX_ATTEMPTS} attempts"
    exit 1
  fi
  echo "Waiting for database... (${ATTEMPTS}/${MAX_ATTEMPTS})"
  sleep 2
done

exec bun run dev:api
