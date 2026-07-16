#!/usr/bin/env bash
# ONE OWNER TURN, end to end. Mechanical only — it moves bytes, it makes no decisions.
#
#   read the screen -> give the brain (intent + screen, nothing else) -> take its ONE action
#   -> hand that action to the dumb driver verbatim -> print what the screen says.
#
# The brain still decides everything. This script never inspects, retries, corrects, or
# substitutes an action; if the brain emits something the driver rejects, the rejection stands
# and the brain sees it next turn. That is the point.
#
# Usage: turn.sh <scratchdir> [wait-seconds-before-reading]
set -u
SP="$1"
WAIT="${2:-0}"
cd /c/ProjectControlCockpit

if [ "$WAIT" -gt 0 ]; then
  node tools/understudy/driver.js "{\"action\":\"wait\",\"seconds\":$WAIT,\"why\":\"let it work\"}" > "$SP/screen.txt" 2>&1
else
  node tools/understudy/driver.js '{"action":"read","why":"look"}' > "$SP/screen.txt" 2>&1
fi

{ cat "$SP/intent.txt"; echo; echo "=========="; echo "This is the screen in front of you:"; echo; cat "$SP/screen.txt"; } > "$SP/turn.txt"

# The brain: blind (permissions.deny strips every tool from its context), stateless per turn.
ACT=$({ cat tools/understudy/owner-brain-prompt.md; echo; echo "=========="; cat "$SP/turn.txt"; } \
  | claude -p --settings tools/understudy/blind-settings.json 2>&1 | grep -o '{.*}' | tail -1)

if [ -z "$ACT" ]; then echo "BRAIN PRODUCED NO ACTION"; exit 1; fi
echo ">>> OWNER: $ACT"

node tools/understudy/driver.js "$ACT" > "$SP/screen.txt" 2>&1
head -1 "$SP/screen.txt"
sed -n '/Creating a new project/,$p' "$SP/screen.txt" | head -6
