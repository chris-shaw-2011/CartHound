#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Unique project, no published ports, no development volume, no .env inputs.
project="carthound-test-$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
export CARTHOUND_TEST_POSTGRES_PASSWORD="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
export CARTHOUND_TEST_DATABASE_URL="postgresql://carthound_test:${CARTHOUND_TEST_POSTGRES_PASSWORD}@postgres-test:5432/carthound_test"
compose() { docker compose --env-file /dev/null -p "$project" --profile test "$@"; }
cleanup() {
  result=$?
  trap - EXIT
  if ! compose down --volumes --remove-orphans; then
    echo "Failed to clean disposable Compose project $project" >&2
    [ "$result" -ne 0 ] || result=1
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
compose build --pull persistence-test
compose up -d --wait --wait-timeout 90 postgres-test
compose run --rm --no-deps persistence-test
