#!/bin/zsh
# Start the Life Chronicle dev stack detached from whatever launched it.
#
# Both servers double-fork via a subshell (macOS has no setsid) so they
# reparent to launchd and survive the launching session (Claude
# background tasks die with their session — that repeatedly took the
# stack down: 2026-06-10 and again 2026-06-11).
# Idempotent: skips anything already listening on its port.
#
#   ./scripts/dev-up.sh          start whatever isn't running
#   Logs: /tmp/lc-next-dev.log, /tmp/lc-inngest-dev.log

cd "$(dirname "$0")/.." || exit 1

if lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "next dev: already running on 3001"
else
  ( nohup npm run dev > /tmp/lc-next-dev.log 2>&1 < /dev/null & )
  echo "next dev: starting on 3001 (log: /tmp/lc-next-dev.log)"
fi

if lsof -nP -iTCP:8288 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "inngest:  already running on 8288"
else
  ( nohup npx inngest-cli@latest dev > /tmp/lc-inngest-dev.log 2>&1 < /dev/null & )
  echo "inngest:  starting on 8288 (log: /tmp/lc-inngest-dev.log)"
fi

# Wait for both ports so the caller gets a definitive answer.
for i in {1..30}; do
  if lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1 && lsof -nP -iTCP:8288 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "dev stack up: next (3001) + inngest (8288)"
    exit 0
  fi
  sleep 1
done
echo "WARNING: stack not fully up after 30s — check the logs in /tmp" >&2
exit 1
