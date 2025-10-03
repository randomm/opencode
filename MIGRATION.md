# Migration Guide: Dual Containers → Unified Container

This guide helps you migrate from the old dual-container setup to the new unified OpenCode container.

## Overview

**Old Setup (Deprecated)**:
- `opencode_sandbox` - Mac terminal access via docker exec
- `opencode_with_ssh` - iPhone SSH access via Tailscale
- Two separate containers, two separate Dockerfiles, two separate compose files

**New Setup**:
- `opencode` - Single unified container
- Access via both docker exec (Mac) AND SSH (iPhone)
- Persistent screen sessions shared across all devices
- One Dockerfile, one compose file, simpler management

## Why Migrate?

✅ **Single source of truth**: One container with all features  
✅ **Persistent sessions**: Start work on Mac, continue on iPhone  
✅ **Simpler setup**: One command to rule them all  
✅ **Feature parity**: All tools available everywhere (gh CLI, Docker socket, SSH)  
✅ **Easier maintenance**: Update once, use everywhere  

## Migration Steps

### Step 1: Backup Current Work

Before migrating, save any in-progress work:

```bash
# If you have work in opencode_sandbox
docker exec -it opencode_sandbox zsh
# Save your work, commit changes, etc.
exit

# If you have work in opencode_with_ssh
ssh opencode@<tailscale-ip>
# Save your work, commit changes, etc.
exit
```

### Step 2: Stop Old Containers

```bash
# Stop the sandbox container
docker compose -f docker-compose.opencode.yml down

# Stop the SSH container
docker compose -f docker-compose.tailscale.yml down

# Verify containers are stopped
docker ps -a | grep opencode
```

### Step 3: Optional - Remove Old Containers

If you want to free up disk space:

```bash
# Remove containers (keeps volumes)
docker rm opencode_sandbox opencode_with_ssh

# Optional: Remove old volumes if you don't need them
# WARNING: This deletes data! Only do this if you've backed up
docker volume rm opencode-ssh  # Old SSH keys volume
docker volume rm opencode_bin  # Old sandbox binary volume
```

### Step 4: Set Up Environment Variables

The unified container uses environment variables from your shell or `.env` file:

```bash
# Required for Tailscale
export TS_AUTHKEY="your-tailscale-auth-key"

# Optional for GitHub CLI auto-auth
export GH_TOKEN="your-github-token"

# Optional for Perplexity MCP
export PERPLEXITY_API_KEY="your-api-key"

# Or create .env file in ~/.config/opencode/
cat > ~/.config/opencode/.env << EOF
TS_AUTHKEY=your-tailscale-auth-key
GH_TOKEN=your-github-token
PERPLEXITY_API_KEY=your-api-key
EOF
```

### Step 5: Start Unified Container

```bash
# Use the new unified launcher script
cd ~/.config/opencode
./scripts/opencode
```

This will:
1. Check if Remory is running (starts it if needed)
2. Build the unified container
3. Start the container with Tailscale
4. Create persistent screen session
5. Attach you to the session

### Step 6: Set Up SSH Keys (for iPhone access)

```bash
# Add your SSH public key to the container
./add-ssh-key.sh ~/.ssh/id_rsa.pub

# Or specify the key path
./add-ssh-key.sh /path/to/your/public/key
```

### Step 7: Test Both Access Methods

**From Mac**:
```bash
# Attach to container
./scripts/opencode

# Test OpenCode
opencode --version

# Test gh CLI
gh auth status

# Test Docker socket
docker ps

# Detach: Ctrl+A then D
```

**From iPhone**:
```bash
# Get SSH connection info
./scripts/opencode --ssh

# Connect from iPhone
ssh opencode@<tailscale-ip>

# Attach to session
screen -r opencode-main

# You should see the same session!
```

### Step 8: Verify Migration Success

Checklist:
- ✅ Can access container from Mac via `./scripts/opencode`
- ✅ Can access container from iPhone via SSH
- ✅ Screen session persists across devices
- ✅ OpenCode works in both access methods
- ✅ gh CLI authenticated
- ✅ Docker socket accessible
- ✅ Workspace mounted at /workspace

### Step 9: Clean Up Old Files (Optional)

Once you've verified everything works, you can archive old files:

```bash
cd ~/.config/opencode

# Create archive directory
mkdir -p archive

# Move old files
mv Dockerfile.opencode archive/
mv Dockerfile.opencode-ssh archive/
mv docker-compose.opencode.yml archive/
mv docker-compose.tailscale.yml archive/
mv scripts/opencode-sandbox archive/
mv entrypoint-ssh.sh archive/
```

**Note**: Don't delete these yet! Keep them for a few weeks in case you need to reference them.

## Troubleshooting Migration Issues

### Issue: Container Won't Start

**Symptoms**: `docker compose up` fails

**Debug**:
```bash
# Check logs
docker compose -f docker-compose.yml logs

# Common causes:
# 1. Remory network doesn't exist
docker network create remory_network

# 2. Conflicting container names
docker ps -a | grep opencode
docker rm <conflicting-container>

# 3. Missing environment variables
./scripts/opencode --status
```

### Issue: SSH Keys Not Working

**Symptoms**: Can't SSH into container

**Solution**:
```bash
# Re-add SSH key
./add-ssh-key.sh ~/.ssh/id_rsa.pub

# Verify key was added
docker exec opencode cat /home/opencode/.ssh/authorized_keys

# Check SSH daemon is running
docker exec opencode pgrep sshd

# Check Tailscale IP
docker exec opencode_tailscale tailscale ip -4
```

### Issue: Screen Session Not Found

**Symptoms**: `screen -r` says no session

**Solution**:
```bash
# Check if container is running
docker ps | grep opencode

# Check container logs
docker logs opencode

# Manually create session
docker exec -it opencode su - opencode -c "screen -dmS opencode-main"

# Attach
docker exec -it opencode su - opencode -c "screen -r opencode-main"
```

### Issue: gh CLI Not Authenticated

**Symptoms**: `gh auth status` fails

**Solution**:
```bash
# Set GH_TOKEN environment variable
export GH_TOKEN="your-github-token"

# Restart container
./scripts/opencode --stop
./scripts/opencode

# Or authenticate manually
docker exec -it opencode su - opencode -c "gh auth login"
```

### Issue: Docker Socket Permission Denied

**Symptoms**: `docker ps` fails with permission error

**Solution**:
```bash
# Check opencode user is in docker group
docker exec opencode groups opencode

# Should show: opencode docker

# If not, rebuild container
docker compose -f docker-compose.yml build --no-cache opencode
docker compose -f docker-compose.yml up -d
```

## Rollback Procedure

If you need to rollback to the old setup:

```bash
# Stop unified container
./scripts/opencode --stop

# Start old sandbox container
docker compose -f archive/docker-compose.opencode.yml up -d

# Start old SSH container
docker compose -f archive/docker-compose.tailscale.yml up -d

# Access sandbox
docker exec -it opencode_sandbox zsh

# Access SSH
ssh opencode@<tailscale-ip>
```

## Differences to Note

| Feature | Old Sandbox | Old SSH | New Unified |
|---------|------------|---------|-------------|
| Docker exec access | ✅ | ❌ | ✅ |
| SSH access | ❌ | ✅ | ✅ |
| gh CLI | ❌ | ✅ | ✅ |
| Docker socket | ✅ | ❌ | ✅ |
| Screen sessions | ❌ | ❌ | ✅ |
| Persistent work | ❌ | ❌ | ✅ |
| Multi-device | ❌ | ❌ | ✅ |

## Post-Migration Benefits

After migration, you'll be able to:

1. **Seamless device switching**: Start on Mac, continue on iPhone
2. **Single mental model**: One container, one workflow
3. **Persistent sessions**: Never lose work due to disconnections
4. **Full feature set**: All tools available everywhere
5. **Easier updates**: Update one container instead of two

## Getting Help

If you encounter issues during migration:

1. Check the [Troubleshooting](#troubleshooting-migration-issues) section above
2. Review [docs/session-management.md](docs/session-management.md) for screen tips
3. Check [docs/tailscale-setup.md](docs/tailscale-setup.md) for SSH issues
4. Review container logs: `docker logs opencode`
5. Create a GitHub issue with error details

## Timeline

- **Now**: Migrate to unified container
- **2 weeks**: Test thoroughly, keep old files in archive/
- **1 month**: Delete archived files if everything works
- **Future**: Enjoy simplified workflow!

Welcome to the unified OpenCode experience! 🎉
