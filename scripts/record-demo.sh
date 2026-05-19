#!/usr/bin/env bash
# scripts/record-demo.sh
#
# Records a terminal demo of `autospec init` running on a sample project.
# Output: scripts/demo.gif (via agg) or scripts/demo.cast (raw asciinema)
#
# Prerequisites:
#   brew install asciinema agg   # macOS
#   # or: apt install asciinema && cargo install agg  # Linux
#
# Usage:
#   chmod +x scripts/record-demo.sh
#   ANTHROPIC_API_KEY=sk-... ./scripts/record-demo.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DEMO_PROJECT="$SCRIPT_DIR/demo-project"
CAST_FILE="$SCRIPT_DIR/demo.cast"
GIF_FILE="$SCRIPT_DIR/demo.gif"

# ── Preflight checks ─────────────────────────────────────────────────────────

if ! command -v asciinema &>/dev/null; then
  echo "Error: asciinema not found. Install it:"
  echo "  macOS:  brew install asciinema"
  echo "  Linux:  sudo apt install asciinema"
  exit 1
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "Error: ANTHROPIC_API_KEY is not set."
  echo "Usage: ANTHROPIC_API_KEY=sk-... ./scripts/record-demo.sh"
  exit 1
fi

# ── Prepare demo project ──────────────────────────────────────────────────────

echo "Preparing demo project at $DEMO_PROJECT..."
rm -rf "$DEMO_PROJECT"
cp -r "$SCRIPT_DIR/demo-project-template" "$DEMO_PROJECT"

cd "$DEMO_PROJECT"
git init -q
git add -A
git commit -q -m "Initial commit: sample Express API"

# ── Record ────────────────────────────────────────────────────────────────────

echo "Recording demo..."

# autospec-demo.sh is the script that actually runs inside the recording
cat > /tmp/autospec-demo-inner.sh << 'INNER'
#!/usr/bin/env bash
set -euo pipefail

# Give the viewer a moment to read each step
type_and_run() {
  local cmd="$1"
  # Simulate typing
  echo -n "$ "
  for ((i=0; i<${#cmd}; i++)); do
    echo -n "${cmd:$i:1}"
    sleep 0.04
  done
  echo
  sleep 0.3
  eval "$cmd"
  sleep 0.8
}

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AutoSpec — Living documentation for any codebase   "
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
sleep 1

echo "# Starting with a fresh Express API project"
sleep 1.5
type_and_run "ls -1"

sleep 1
echo
echo "# One command to generate all documentation"
sleep 1.5
type_and_run "autospec init --no-hooks"

sleep 1
echo
echo "# See what was generated"
type_and_run "ls .autospec/"

sleep 1
echo
echo "# The architecture doc knows about your project"
type_and_run "head -30 .autospec/ARCHITECTURE.md"

sleep 1
echo
echo "# CLAUDE.md is ready for Claude Code to pick up"
type_and_run "cat CLAUDE.md"

sleep 1.5
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  npm install -g autospec   |   github.com/autospec  "
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 3
INNER
chmod +x /tmp/autospec-demo-inner.sh

# Use a fixed 80×24 terminal size for consistent GIF output
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
asciinema rec \
  --cols 82 \
  --rows 26 \
  --title "AutoSpec demo" \
  --overwrite \
  --command "bash /tmp/autospec-demo-inner.sh" \
  "$CAST_FILE"

echo "Cast saved to $CAST_FILE"

# ── Convert to GIF (optional, requires agg) ───────────────────────────────────

if command -v agg &>/dev/null; then
  echo "Converting to GIF..."
  agg \
    --cols 82 \
    --rows 26 \
    --speed 1.2 \
    --font-size 14 \
    --line-height 1.4 \
    --theme monokai \
    "$CAST_FILE" "$GIF_FILE"
  echo "GIF saved to $GIF_FILE"
  echo
  echo "Add to README.md:"
  echo "  ![AutoSpec demo](scripts/demo.gif)"
else
  echo
  echo "To convert to GIF, install agg:"
  echo "  macOS:  brew install agg"
  echo "  Linux:  cargo install agg"
  echo
  echo "Then run:"
  echo "  agg --speed 1.2 --theme monokai $CAST_FILE $GIF_FILE"
fi

echo "Done."
