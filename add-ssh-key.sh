#!/bin/bash
# Helper script to add SSH public key to OpenCode container

set -euo pipefail

if [ -z "$1" ]; then
  echo "Usage: ./add-ssh-key.sh <path-to-public-key>"
  echo ""
  echo "Example:"
  echo "  ./add-ssh-key.sh ~/.ssh/id_ed25519.pub"
  echo ""
  echo "Or provide the key directly:"
  echo "  ./add-ssh-key.sh 'ssh-ed25519 AAAA...'"
  exit 1
fi

# Check if argument is a file or a key string
if [ -f "$1" ]; then
  SSH_KEY=$(cat "$1")
  echo "Reading SSH key from file: $1"
else
  SSH_KEY="$1"
  echo "Using provided SSH key string"
fi

# Validate SSH key format to prevent command injection
if [[ ! "$SSH_KEY" =~ ^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp[0-9]+)[[:space:]][A-Za-z0-9+/=]+ ]]; then
  echo "ERROR: Invalid SSH key format"
  echo "Expected format: ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp[256|384|521] [base64-key] [optional-comment]"
  echo ""
  echo "Your key starts with: ${SSH_KEY:0:20}..."
  exit 1
fi

# Check if container is running
if ! docker ps | grep -q opencode; then
  echo "ERROR: opencode container is not running"
  echo "Run ./scripts/opencode first"
  exit 1
fi

echo ""
echo "Adding SSH key to container..."
# Use stdin to avoid shell interpolation and prevent command injection
echo "$SSH_KEY" | docker exec -i opencode tee -a /home/opencode/.ssh/authorized_keys > /dev/null
docker exec opencode chmod 600 /home/opencode/.ssh/authorized_keys
docker exec opencode chown opencode:opencode /home/opencode/.ssh/authorized_keys

echo "✓ SSH key added successfully"
echo ""

# Get Tailscale IP with error handling
if ! TAILSCALE_IP=$(docker exec opencode_tailscale tailscale ip -4 2>/dev/null); then
  echo "⚠️  Could not retrieve Tailscale IP"
  echo "   Container may still be connecting to Tailscale"
  echo ""
else
  echo "You can now connect with:"
  echo "  ssh opencode@${TAILSCALE_IP}"
  echo ""
fi
