#!/usr/bin/env bash
# Sequential recategorization across all categories.
#
# - Waits for any in-flight skincare apply to finish first.
# - Runs each remaining category in turn with --apply --use-brave.
# - Each category gets its own snapshot file.
# - Per-category logs at /tmp/recat-<category>.log.
# - Final summary written to /tmp/recat-sweep-summary.log.
#
# Usage:
#   bash scripts/recategorize-sweep.sh
#   bash scripts/recategorize-sweep.sh --concurrency=4

set -euo pipefail

cd "$(dirname "$0")/.."

CONCURRENCY="${1:-}"
if [[ "$CONCURRENCY" == --concurrency=* ]]; then
  CONC_FLAG="$CONCURRENCY"
else
  CONC_FLAG="--concurrency=4"
fi

# Wait for skincare apply (if running) to finish.
if [ -f /tmp/skincare-apply.log ] && ! grep -q '^Processed:' /tmp/skincare-apply.log; then
  echo "[sweep] Waiting for skincare apply to finish..."
  while ! grep -q '^Processed:' /tmp/skincare-apply.log; do
    sleep 30
  done
  echo "[sweep] Skincare done."
fi

# The categories that still need a sweep. Skincare is presumed already
# done by the foreground job; if you want to redo it, prepend it here.
CATEGORIES=(food beverage snack dairy water)

SUMMARY=/tmp/recat-sweep-summary.log
echo "Recategorize sweep — $(date)" > "$SUMMARY"

for cat in "${CATEGORIES[@]}"; do
  LOG="/tmp/recat-${cat}.log"
  echo "" | tee -a "$SUMMARY"
  echo "[sweep] Starting $cat → $LOG" | tee -a "$SUMMARY"
  node scripts/recategorize.mjs --category="$cat" --apply --use-brave "$CONC_FLAG" > "$LOG" 2>&1 || {
    echo "[sweep] $cat exited non-zero. Continuing." | tee -a "$SUMMARY"
  }
  TALLY=$(grep -E "^Processed:" "$LOG" | tail -1 || echo "(no completion line)")
  SNAPSHOT=$(grep "Snapshot saved:" "$LOG" | tail -1 || echo "(no snapshot)")
  echo "[sweep] $cat $TALLY" | tee -a "$SUMMARY"
  echo "[sweep] $cat $SNAPSHOT" | tee -a "$SUMMARY"
done

echo "" | tee -a "$SUMMARY"
echo "[sweep] Complete — $(date)" | tee -a "$SUMMARY"
