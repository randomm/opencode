#!/usr/bin/env bash
# OpenCode Session Attach Script (runs inside container)
# Ensures fresh screen session with current .zshrc configuration
# Used by both Mac (docker exec) and iPhone (SSH) access

set -euo pipefail

SESSION_NAME="opencode-main"

# Force refresh screen session to pick up latest .zshrc and fix any stale state
echo "🔄 Refreshing screen session..."
screen -X -S "$SESSION_NAME" quit 2>/dev/null || true
screen -dmS "$SESSION_NAME" zsh
sleep 0.3

# Attach to session
echo "✨ Attaching to OpenCode session..."
exec screen -r "$SESSION_NAME"
