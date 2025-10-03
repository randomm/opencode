#!/bin/bash
set -euo pipefail

# This script runs as ROOT (from Dockerfile USER root)
# SSH daemon requires root privileges to bind to port 22 and handle authentication

echo "=== OpenCode SSH Container Starting ==="

# Start SSH daemon as root (no sudo needed - we ARE root)
echo "Starting SSH daemon..."
/usr/sbin/sshd -D -e &
SSH_PID=$!

# Wait for Tailscale to be ready
echo "Waiting for Tailscale connection..."
MAX_WAIT=60
COUNTER=0

while [ $COUNTER -lt $MAX_WAIT ]; do
  if tailscale status &>/dev/null 2>&1; then
    echo "✓ Tailscale connected!"
    tailscale status
    
    # Get Tailscale IP
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "unknown")
    
    echo ""
    echo "=== Container Ready ==="
    echo "Tailscale IP: $TAILSCALE_IP"
    echo "SSH Port: 22"
    echo "User: opencode"
    echo ""
    echo "Connect with: ssh opencode@$TAILSCALE_IP"
    echo "======================"
    break
  fi
  sleep 2
  COUNTER=$((COUNTER + 2))
done

if [ $COUNTER -ge $MAX_WAIT ]; then
  echo "ERROR: Tailscale connection timeout after ${MAX_WAIT}s"
  echo "Container startup failed - Tailscale is required for SSH access"
  exit 1
fi

# Keep container running and forward signals to SSH daemon
trap "kill $SSH_PID 2>/dev/null; exit 0" SIGTERM SIGINT

echo "Monitoring SSH daemon (PID: $SSH_PID)..."

# Wait for SSH daemon
wait $SSH_PID
