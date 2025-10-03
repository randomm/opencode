#!/bin/bash
# Setup script for Tailscale + SSH OpenCode container

set -euo pipefail

echo "=== OpenCode Tailscale + SSH Setup ==="
echo ""

# Check if TS_AUTHKEY is provided
if [ -z "$TS_AUTHKEY" ]; then
  echo "ERROR: TS_AUTHKEY environment variable not set"
  echo ""
  echo "To get your Tailscale auth key:"
  echo "1. Go to https://login.tailscale.com/admin/settings/keys"
  echo "2. Click 'Generate auth key'"
  echo "3. Enable: 'Reusable' ✅ and 'Ephemeral' ✅"
  echo "4. Copy the key (starts with 'tskey-auth-...')"
  echo ""
  echo "Then run:"
  echo "  export TS_AUTHKEY='tskey-auth-...'"
  echo "  ./setup-tailscale-ssh.sh"
  exit 1
fi

# Validate auth key format
if [[ ! "$TS_AUTHKEY" =~ ^tskey-auth- ]]; then
  echo "ERROR: Invalid Tailscale auth key format"
  echo "Expected format: tskey-auth-..."
  echo "Current value starts with: ${TS_AUTHKEY:0:10}..."
  exit 1
fi

# Validate key length (auth keys are typically 60+ characters)
if [ ${#TS_AUTHKEY} -lt 40 ]; then
  echo "ERROR: Tailscale auth key appears too short"
  echo "Expected at least 40 characters, got ${#TS_AUTHKEY}"
  exit 1
fi

echo "✓ Tailscale auth key validated"
echo ""

# Build the OpenCode image with SSH
echo "Building OpenCode SSH container..."
docker compose -f docker-compose.tailscale.yml build

echo ""
echo "✓ Container built successfully"
echo ""

# Start services
echo "Starting Tailscale + OpenCode services..."
docker compose -f docker-compose.tailscale.yml up -d

echo ""
echo "Waiting for Tailscale to connect (this may take 10-15 seconds)..."
sleep 15

# Get Tailscale status
echo ""
echo "=== Tailscale Status ==="
docker exec opencode_tailscale tailscale status

# Get Tailscale IP with validation
if ! TAILSCALE_IP=$(docker exec opencode_tailscale tailscale ip -4 2>/dev/null); then
  echo ""
  echo "⚠️  Could not retrieve Tailscale IP"
  echo "Container may still be connecting to Tailscale"
  exit 1
fi

# Validate IP format
if [[ ! "$TAILSCALE_IP" =~ ^100\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  echo ""
  echo "⚠️  Invalid Tailscale IP format: $TAILSCALE_IP"
  echo "Expected 100.x.x.x range"
  exit 1
fi

echo ""
echo "=== Container Tailscale IP ==="
echo "IP: $TAILSCALE_IP"

echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Add your SSH public key to the container:"
echo "   Use the helper script: ./add-ssh-key.sh ~/.ssh/id_ed25519.pub"
echo "   Or manually: cat ~/.ssh/id_ed25519.pub | docker exec -i opencode_with_ssh tee /home/opencode/.ssh/authorized_keys > /dev/null"
echo ""
echo "2. Test SSH connection from your Mac:"
echo "   ssh opencode@${TAILSCALE_IP}"
echo ""
echo "3. Once connected, test OpenCode:"
echo "   opencode --help"
echo ""
echo "4. Configure SSH on your iPhone (in a terminal app like Termius or Blink):"
echo "   Host: ${TAILSCALE_IP}"
echo "   Port: 22"
echo "   User: opencode"
echo "   Auth: Use your SSH private key"
echo ""
