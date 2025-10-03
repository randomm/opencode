#!/bin/bash
set -euo pipefail

# OpenCode Unified Container Entrypoint
# This script runs as ROOT to manage system services
# Responsibilities:
# 1. Start SSH daemon for remote access
# 2. Auto-authenticate GitHub CLI if GH_TOKEN present
# 3. Create persistent screen session for multi-device access
# 4. Keep container running

echo "=== OpenCode Unified Container Starting ==="

# =============================================================================
# Start SSH Daemon
# =============================================================================

echo "Starting SSH daemon..."
/usr/sbin/sshd -D -e &
SSH_PID=$!
echo "SSH daemon started (PID: $SSH_PID)"

# =============================================================================
# Configure Docker Socket Permissions Dynamically
# =============================================================================

if [ -S /var/run/docker.sock ]; then
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo "999")
    if ! getent group "$DOCKER_GID" >/dev/null 2>&1; then
        groupadd -g "$DOCKER_GID" docker 2>/dev/null || true
    fi
    usermod -aG "$DOCKER_GID" opencode 2>/dev/null || true
    echo "✓ Docker socket permissions configured (GID: $DOCKER_GID)"
fi

# =============================================================================
# GitHub CLI Authentication
# =============================================================================

if [[ -n "${GH_TOKEN:-}" ]]; then
    echo "Authenticating GitHub CLI..."
    
    # Create gh config directory if it doesn't exist
    mkdir -p /home/opencode/.config/gh
    chown opencode:opencode /home/opencode/.config/gh
    
    # Authenticate gh as opencode user
    su - opencode -c "echo '$GH_TOKEN' | gh auth login --with-token" 2>/dev/null || {
        echo "Warning: GitHub CLI authentication failed (token may be invalid)"
    }
    
    # Verify authentication
    if su - opencode -c "gh auth status" >/dev/null 2>&1; then
        echo "GitHub CLI authenticated successfully"
    else
        echo "Warning: GitHub CLI not authenticated"
    fi
else
    echo "GH_TOKEN not set - GitHub CLI will require manual authentication"
fi

# =============================================================================
# Create Persistent Screen Session
# =============================================================================

echo "Creating persistent screen session: opencode-main"

# Start screen session as opencode user, detached
# The session runs a shell that keeps the session alive
su - opencode -c "screen -dmS opencode-main zsh"

# Wait for screen session with timeout and retry logic
MAX_WAIT=10
COUNTER=0
while [ $COUNTER -lt $MAX_WAIT ]; do
    if su - opencode -c "screen -ls 2>/dev/null" | grep -q "opencode-main"; then
        echo "✓ Screen session 'opencode-main' created successfully"
        echo ""
        echo "To attach from Mac:     ./scripts/opencode"
        echo "To attach via SSH:      ssh opencode@<tailscale-ip> -t 'screen -r opencode-main'"
        echo "To detach from screen:  Ctrl+A then D"
        break
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
done

if [ $COUNTER -ge $MAX_WAIT ]; then
    echo "⚠️  Screen session creation timeout (not critical - will be created on first attach)"
fi

# =============================================================================
# Container Ready
# =============================================================================

echo ""
echo "=== Container Ready ==="
echo "SSH Port: 22 (via Tailscale network)"
echo "User: opencode"
echo "Session: opencode-main (screen)"
echo "Docker socket: /var/run/docker.sock"
echo "======================"

# =============================================================================
# Keep Container Running
# =============================================================================

# Set up signal handling for graceful shutdown
cleanup() {
    echo ""
    echo "=== Shutting down gracefully ==="
    
    # Kill screen session
    su - opencode -c "screen -S opencode-main -X quit" 2>/dev/null || true
    
    # Kill SSH daemon
    kill "$SSH_PID" 2>/dev/null || true
    
    echo "Shutdown complete"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Keep container running by waiting on SSH daemon
echo "Container is running. Waiting for shutdown signal..."
wait "$SSH_PID"
