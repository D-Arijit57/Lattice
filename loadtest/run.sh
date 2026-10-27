#!/bin/sh
# Usage: loadtest/run.sh <label> <scenario> [-e MODE=ramp -e RATE=100 -e DURATION=60s ...]
# Writes loadtest/results/<label>-<scenario>-<timestamp>.{json,meta.txt}
set -e
cd "$(dirname "$0")"
LABEL=${1:?label e.g. baseline-w1}; SCEN=${2:?scenario list|deep|detail|health|throttle}; shift 2
# fresh process => empty LocMem throttle counters and cold-start state every run
docker compose -f docker-compose.loadtest.yml restart backend >/dev/null
until curl -sf -H "X-Forwarded-Proto: https" localhost:8000/api/monitoring/health/ >/dev/null; do sleep 1; done
TS=$(date +%Y%m%d-%H%M%S)
OUT="results/${LABEL}-${SCEN}-${TS}"
{
  echo "git_sha=$(git rev-parse --short HEAD) dirty=$(git status --porcelain -- ../backend | wc -l | tr -d ' ')"
  echo "machine=$(sysctl -n machdep.cpu.brand_string) cores=$(sysctl -n hw.ncpu) ram_gb=$(( $(sysctl -n hw.memsize) / 1073741824 ))"
  echo "k6=$(k6 version)"
  echo "workers=$(docker compose -f docker-compose.loadtest.yml exec -T backend sh -c 'echo ${WEB_CONCURRENCY:-1}') gunicorn_args=$(docker compose -f docker-compose.loadtest.yml exec -T backend sh -c 'echo $GUNICORN_CMD_ARGS')"
  echo "docker=$(docker info --format 'cpus={{.NCPU}} mem_bytes={{.MemTotal}}')"
  echo "dataset=$(cat meta.json)"
  echo "scenario=$SCEN args=$*"
} > "${OUT}.meta.txt"
k6 run -e SCENARIO="$SCEN" "$@" --summary-export "${OUT}.json" delivery.js | tee "${OUT}.log"
