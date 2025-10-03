# Tailscale + SSH OpenCode Setup

Secure remote access to OpenCode from your iPhone using Tailscale VPN and SSH with persistent sessions.

## Overview

The unified OpenCode container provides encrypted remote access through a containerized environment with persistent screen sessions. You can start work on your Mac, detach, and continue from your iPhone terminal app - all in the same session.

**Architecture:**
```
Mac Terminal → Docker exec → Unified Container ← SSH ← Tailscale ← iPhone
                            (screen session shared)
```

**Security:**
- ✅ Official software only (Tailscale, OpenSSH, Node.js)
- ✅ SSH key-only authentication (passwords disabled)
- ✅ Non-root user execution
- ✅ Tailscale VPN encryption (WireGuard)
- ✅ Ephemeral auth keys (auto-expire)

**Why this approach vs Signal Bridge?**
- No third-party forks or unofficial APIs
- Proven, audited security
- Simple, maintainable infrastructure

## Prerequisites

Before starting, ensure you have:

1. **Tailscale installed** on Mac and iPhone
2. **Devices connected** to same Tailscale network
3. **Docker installed** and running on Mac
4. **SSH key pair** (e.g., `~/.ssh/id_ed25519`)
5. **Remory network** exists: `docker network ls | grep remory`

Verify Tailscale is running:
```bash
tailscale status  # Should show your Mac's Tailscale IP (100.x.x.x)
```

## Quick Start

### 1. Get Tailscale Auth Key

1. Visit [Tailscale Admin Keys](https://login.tailscale.com/admin/settings/keys)
2. Click **"Generate auth key"**
3. Enable these options:
   - ✅ **Reusable** (allows container restarts)
   - ✅ **Ephemeral** (auto-cleanup when container stops)
4. Copy the key (starts with `tskey-auth-...`)

### 2. Set Up Environment

```bash
cd ~/.config/opencode

# Set environment variables
export TS_AUTHKEY='tskey-auth-xxxxx'
export GH_TOKEN='ghp_xxxxx'           # Optional: GitHub CLI auto-auth
export PERPLEXITY_API_KEY='pplx_xxxxx' # Optional: Perplexity MCP

# Or create .env file (recommended)
cat > .env << EOF
TS_AUTHKEY=tskey-auth-xxxxx
GH_TOKEN=ghp_xxxxx
PERPLEXITY_API_KEY=pplx_xxxxx
EOF
```

### 3. Start Unified Container

```bash
# Smart launcher handles everything
./scripts/opencode

# This will:
# - Check/start Remory MCP server
# - Build unified container (first time)
# - Start Tailscale and OpenCode services
# - Create persistent screen session
# - Attach you to the session
```

### 4. Add Your SSH Public Key

```bash
# Use the helper script
./add-ssh-key.sh ~/.ssh/id_ed25519.pub

# Or provide the key directly
./add-ssh-key.sh 'ssh-ed25519 AAAA...'
```

### 5. Test Multi-Device Workflow

**On Mac:**
```bash
# Attach to session
./scripts/opencode

# Work in OpenCode
opencode "Review this codebase"

# Detach from session: Ctrl+A then D
# (Session keeps running!)
```

**On iPhone:**
```bash
# Get SSH connection info
./scripts/opencode --ssh

# Connect via SSH (using Termius, Blink Shell, etc.)
ssh opencode@<tailscale-ip>

# Attach to the SAME session you were using on Mac!
screen -r opencode-main

# Continue working...
# Detach: Ctrl+A then D
```

### 5. Configure iPhone SSH Client

Use a terminal app like **Termius** or **Blink Shell**:

**Create SSH Connection:**
- Host: `100.x.x.x` (your container's Tailscale IP from step 4)
- Port: `22`
- User: `opencode`
- Authentication: SSH Key

**Add SSH Private Key:**
1. Import your private key to the terminal app
2. Assign it to this connection
3. Save the configuration

**Connect and Test:**
```bash
ssh opencode@[TAILSCALE_IP]
opencode --help
opencode @python-best-practices-architect "Fix linting errors"
```

## Common Commands

### Status and Monitoring

```bash
# Check all-in-one status
./check-tailscale.sh

# Get container's Tailscale IP
docker exec opencode_tailscale tailscale ip -4

# Check Tailscale connection status
docker exec opencode_tailscale tailscale status

# View container logs
docker logs opencode
docker logs opencode_tailscale

# Check container status
docker compose -f docker-compose.tailscale.yml ps
```

### Container Management

```bash
# Restart services
docker compose -f docker-compose.tailscale.yml restart

# Stop services
docker compose -f docker-compose.tailscale.yml down

# View logs with follow
docker compose -f docker-compose.tailscale.yml logs -f
```

### SSH Key Management

```bash
# View authorized SSH keys
docker exec opencode cat /home/opencode/.ssh/authorized_keys

# Add another SSH key
./add-ssh-key.sh ~/.ssh/another_key.pub

# Check SSH key permissions
docker exec opencode ls -la /home/opencode/.ssh/
```

## Troubleshooting

### Tailscale Not Connecting

**Symptoms:** Container doesn't appear in Tailscale network

**Solutions:**
```bash
# Check Tailscale logs for errors
docker logs opencode_tailscale

# Verify auth key is set correctly
echo $TS_AUTHKEY

# Regenerate auth key if expired (ephemeral keys expire after 15-20 minutes)
# Then run setup script again
```

### SSH Connection Refused

**Symptoms:** `Connection refused` when trying to SSH

**Solutions:**
```bash
# Verify SSH daemon is running
docker exec opencode pgrep sshd

# Check SSH configuration
docker exec opencode cat /etc/ssh/sshd_config | grep -E "(PermitRoot|PasswordAuth|PubkeyAuth)"

# Verify SSH is listening on port 22
docker exec opencode netstat -tlnp | grep :22
```

### Permission Denied (publickey)

**Symptoms:** SSH authentication fails

**Solutions:**
```bash
# Verify authorized_keys file exists and has correct permissions
docker exec opencode ls -la /home/opencode/.ssh/

# Re-add your SSH public key
./add-ssh-key.sh ~/.ssh/id_ed25519.pub

# Check authorized_keys content
docker exec opencode cat /home/opencode/.ssh/authorized_keys
```

### Can't Find Tailscale IP

**Symptoms:** IP command returns empty or errors

**Solutions:**
```bash
# Wait for Tailscale to fully connect (can take 10-30 seconds)
sleep 10
docker exec opencode_tailscale tailscale status

# Get IP from network interface directly
docker exec opencode_tailscale ip addr show tailscale0

# Check if Tailscale is authenticated
docker exec opencode_tailscale tailscale status | grep "logged in"
```

### Mac Tailscale Logged Out

**Symptoms:** Mac shows "Logged out" in Tailscale

**Solutions:**
```bash
# Log into Tailscale on Mac
tailscale up

# Verify connection
tailscale status

# Check both devices are on same network
```

### Container Restarts Lose Tailscale Connection

**Symptoms:** After container restart, no Tailscale IP

**Solutions:**
```bash
# Ensure you used a "Reusable" auth key when generating
# If not, generate a new reusable auth key

# Restart with auth key
TS_AUTHKEY='tskey-auth-xxxxxxxxxxxxxxx' ./setup-tailscale-ssh.sh
```

## Files Created

This setup creates the following files in `/Users/janni/.config/opencode`:

**Core Infrastructure:**
- `docker-compose.tailscale.yml` - Docker Compose configuration
- `Dockerfile.opencode-ssh` - OpenCode container with SSH
- `entrypoint-ssh.sh` - Container startup script

**Helper Scripts:**
- `setup-tailscale-ssh.sh` - Automated setup script
- `add-ssh-key.sh` - SSH key management helper
- `check-tailscale.sh` - Status checker

**Documentation:**
- `docs/tailscale-setup.md` - This file

## Security Details

### Authentication

- **SSH Key-Only Authentication**: Password authentication is disabled in SSH configuration
- **Non-Root User**: OpenCode runs as `opencode` user (UID 1000)
- **Root Login Disabled**: SSH root login is explicitly disabled
- **User Restrictions**: Only `opencode` user is allowed to SSH

### Network Security

- **Tailscale VPN**: All traffic encrypted via WireGuard protocol
- **Ephemeral Auth Keys**: Container auth keys auto-expire when container stops
- **Network Isolation**: Container runs on isolated Docker network
- **No Direct Exposure**: No ports exposed to public internet

### Software Provenance

- **Tailscale**: `tailscale/tailscale:latest` (official Docker image)
- **OpenSSH**: Installed from Debian official repositories
- **Node.js**: `node:20-slim` (official Docker image)
- **OpenCode**: Installed via official npm package

## What's Next

Once your SSH connection is working from your iPhone:

1. **Install a terminal app** (recommended: Termius or Blink Shell)
2. **Configure the SSH connection** with your container's Tailscale IP
3. **Import your SSH private key** to the terminal app
4. **Connect and use OpenCode remotely!**

**Advanced Usage:**
- Set up persistent sessions with `tmux` or `screen`
- Configure git credentials for commits from SSH
- Optimize OpenCode config for remote usage
- Create aliases for common OpenCode commands
