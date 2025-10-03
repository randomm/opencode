#!/bin/bash
# Check Tailscale network status

set -euo pipefail

echo "=== Tailscale Network Status ==="
echo ""

# Check Mac Tailscale
echo "📱 Mac Tailscale:"
if command -v tailscale &> /dev/null; then
    tailscale status 2>/dev/null || echo "   ⚠️  Tailscale not running on Mac"
else
    echo "   ⚠️  Tailscale not installed on Mac"
fi

echo ""

# Check if containers are running
echo "🐳 Docker Containers:"
if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(opencode_tailscale|opencode_with_ssh)"; then
    echo ""
    echo "📡 Container Tailscale Status:"
    docker exec opencode_tailscale tailscale status 2>/dev/null || echo "   ⚠️  Tailscale not running in container"
    
    echo ""
    echo "🌐 Container Tailscale IP:"
    if TAILSCALE_IP=$(docker exec opencode_tailscale tailscale ip -4 2>/dev/null); then
        # Validate Tailscale IP format (100.x.x.x range)
        if [[ "$TAILSCALE_IP" =~ ^100\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "   IP: $TAILSCALE_IP"
            echo ""
            echo "   SSH Command: ssh opencode@$TAILSCALE_IP"
        else
            echo "   ⚠️  Invalid Tailscale IP format: $TAILSCALE_IP"
            echo "   ⚠️  Expected 100.x.x.x range"
        fi
    else
        echo "   ⚠️  No IP assigned yet (Tailscale still connecting?)"
    fi
else
    echo "   ⚠️  Containers not running"
    echo ""
    echo "   Start with: ./setup-tailscale-ssh.sh"
fi

echo ""
echo "================================="
