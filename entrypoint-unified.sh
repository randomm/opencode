#!/bin/bash
set -euo pipefail

echo "=== OpenCode Container Starting ==="

# Start SSH daemon
echo "Starting SSH daemon..."
/usr/sbin/sshd -D -e &
SSH_PID=$!

# Configure Docker socket permissions dynamically
if [ -S /var/run/docker.sock ]; then
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo "999")
  if ! getent group "$DOCKER_GID" >/dev/null 2>&1; then
    groupadd -g "$DOCKER_GID" docker 2>/dev/null || true
  fi
  usermod -aG "$DOCKER_GID" opencode 2>/dev/null || true
  echo "✓ Docker socket configured (GID: $DOCKER_GID)"
fi

# Auto-authenticate GitHub CLI if token present
if [ -n "${GH_TOKEN:-}" ]; then
  echo "Authenticating GitHub CLI..."
  if su - opencode -c "echo '${GH_TOKEN}' | gh auth login --with-token"; then
    su - opencode -c "gh config set git_protocol ssh" || true
    echo "✓ GitHub CLI authenticated"
  else
    echo "⚠️  GitHub CLI authentication failed"
  fi
fi

# Create screen session if it doesn't exist
if ! su - opencode -c "screen -ls 2>/dev/null" | grep -q "opencode-main"; then
  su - opencode -c "screen -dmS opencode-main zsh"
  sleep 1
  echo "✓ Screen session 'opencode-main' created"
else
  echo "✓ Screen session 'opencode-main' already exists"
fi

echo ""
echo "=== Container Ready ==="
echo "SSH: port 22"
echo "Screen: opencode-main"
echo "======================"

# Keep container running
trap "kill $SSH_PID 2>/dev/null; exit 0" SIGTERM SIGINT
wait $SSH_PID
