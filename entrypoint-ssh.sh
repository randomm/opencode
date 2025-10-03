#!/bin/bash
set -euo pipefail

# This script runs as ROOT (from Dockerfile USER root)
# SSH daemon requires root privileges to bind to port 22 and handle authentication

echo "=== OpenCode SSH Container Starting ==="

# Start SSH daemon as root (no sudo needed - we ARE root)
echo "Starting SSH daemon..."
/usr/sbin/sshd -D -e &
SSH_PID=$!

# Container uses network_mode: service:tailscale
# Tailscale connectivity is guaranteed by depends_on relationship
# No need to check - just start SSH and run

echo ""
echo "=== Container Ready ==="
echo "SSH Port: 22 (via Tailscale network)"
echo "User: opencode"
echo "Note: Container shares network with Tailscale sidecar"
echo "======================"

# Keep container running and forward signals to SSH daemon
trap "kill $SSH_PID 2>/dev/null; exit 0" SIGTERM SIGINT

echo "Monitoring SSH daemon (PID: $SSH_PID)..."

# Wait for SSH daemon
wait $SSH_PID
