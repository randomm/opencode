# Session Management Guide

Learn how to use persistent screen sessions in the OpenCode unified container for seamless multi-device workflow.

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Screen Basics](#screen-basics)
- [Multi-Device Workflow](#multi-device-workflow)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)

## Overview

The unified OpenCode container uses **screen** (a terminal multiplexer) to provide persistent sessions that:
- **Stay alive** when you disconnect
- **Can be accessed** from multiple devices (Mac, iPhone, iPad)
- **Share the same session** across all devices
- **Survive SSH disconnections**

Think of screen as a virtual terminal that keeps running even when you're not connected to it.

## Quick Start

### From Mac Terminal

```bash
# Start or attach to OpenCode
./scripts/opencode

# Work in the session
opencode "Add error handling to API"

# Detach from session (keeps running)
# Press: Ctrl+A then D

# Reattach later
./scripts/opencode
```

### From iPhone via SSH

```bash
# Connect via Tailscale
ssh opencode@<tailscale-ip>

# Attach to the same session you were using on Mac!
screen -r opencode-main

# Detach when done
# Press: Ctrl+A then D
```

## Screen Basics

### What is Screen?

Screen is a terminal multiplexer that allows you to:
- Run multiple terminal windows in one session
- Detach and reattach to sessions
- Keep processes running in the background
- Share sessions across devices

### Key Concepts

- **Session**: A screen instance (our session is named `opencode-main`)
- **Window**: A terminal within a session (like browser tabs)
- **Detach**: Disconnect from session (it keeps running)
- **Attach**: Reconnect to a running session

### Essential Commands

All screen commands start with **Ctrl+A** (called the "command prefix").

| Action | Keys | Description |
|--------|------|-------------|
| Detach | `Ctrl+A` then `D` | Leave session (keeps running) |
| New Window | `Ctrl+A` then `C` | Create new terminal window |
| Next Window | `Ctrl+A` then `N` | Switch to next window |
| Previous Window | `Ctrl+A` then `P` | Switch to previous window |
| List Windows | `Ctrl+A` then `"` | Show all windows |
| Rename Window | `Ctrl+A` then `A` | Rename current window |
| Kill Window | `Ctrl+A` then `K` | Close current window |
| Scrollback | `Ctrl+A` then `[` | Enter copy/scroll mode |
| Help | `Ctrl+A` then `?` | Show all keybindings |

### Outside Screen Commands

```bash
# List all screen sessions
screen -ls

# Attach to a session
screen -r opencode-main

# Detach someone else's session and attach
screen -dr opencode-main

# Create new session
screen -S my-session-name
```

## Multi-Device Workflow

### Scenario 1: Start on Mac, Continue on iPhone

```bash
# On Mac
./scripts/opencode
opencode "Implement user authentication"
# Press Ctrl+A then D to detach

# On iPhone (via SSH)
ssh opencode@<tailscale-ip>
screen -r opencode-main
# You see exactly where you left off!
# Continue working...
# Press Ctrl+A then D when done
```

### Scenario 2: Multiple Windows for Different Tasks

```bash
# Attach to session
./scripts/opencode

# Window 1: Working on a feature
opencode "Add dark mode"

# Create new window: Ctrl+A then C
# Window 2: Run tests
pytest tests/

# Create another window: Ctrl+A then C
# Window 3: Monitor logs
docker logs -f remory_mcp_server

# Switch between windows:
# Ctrl+A then N (next)
# Ctrl+A then P (previous)
# Ctrl+A then " (list all)

# Detach: Ctrl+A then D
# All windows keep running!
```

### Scenario 3: Collaborative Session

```bash
# Person A on Mac
./scripts/opencode
# Working...

# Person B on iPhone (simultaneously!)
ssh opencode@<tailscale-ip>
screen -r opencode-main
# Both see the same screen!
# Great for pair programming or debugging
```

## Common Operations

### Rename a Window

Helpful for organizing multiple windows:

```bash
# In the window you want to rename
# Press: Ctrl+A then A
# Type new name and press Enter
```

### Copy/Paste in Screen

```bash
# Enter copy mode: Ctrl+A then [
# Use arrow keys to navigate
# Press Space to start selection
# Move to end of text
# Press Space again to copy
# Press Ctrl+A then ] to paste
```

### Scrollback

```bash
# Enter scrollback mode: Ctrl+A then [
# Use arrow keys, Page Up/Down to scroll
# Press Esc to exit
```

### Split Screen (Advanced)

```bash
# Horizontal split: Ctrl+A then S
# Switch to new region: Ctrl+A then Tab
# Create window in region: Ctrl+A then C
# Remove split: Ctrl+A then X
```

## Troubleshooting

### Can't Attach to Session

**Problem**: `screen -r` says "There is no screen to be resumed"

**Solution**:
```bash
# List all sessions
screen -ls

# Session might be attached elsewhere
screen -dr opencode-main

# If session doesn't exist, it may have crashed
# Check container logs
docker logs opencode

# Restart container
./scripts/opencode --stop
./scripts/opencode
```

### Session is Frozen

**Problem**: Terminal doesn't respond to input

**Cause**: Accidentally pressed `Ctrl+S` (stops output)

**Solution**: Press `Ctrl+Q` (resumes output)

### Lost in Screen

**Problem**: Not sure which window you're in or what's running

**Solution**:
```bash
# List all windows: Ctrl+A then "
# Shows window numbers and names
# Press number to jump to that window
```

### Want to Exit Screen Completely

```bash
# Kill all windows and exit: Ctrl+A then \
# Confirms: "Really kill this window [y/n]"

# Or exit each window individually
# In each window, type: exit
# Screen exits when last window closes
```

### iPhone Screen Command Issues

**Problem**: Can't use `Ctrl+A` on iPhone keyboard

**Solutions**:
1. Use iOS keyboard apps that support Ctrl key (like Blink Shell, Termius)
2. Remap screen prefix to different key (see Advanced Configuration)
3. Use SSH app with custom keybindings

### Session State Not Saved

**Problem**: Work is lost after detaching

**Cause**: You exited the shell instead of detaching

**Solution**:
- Always detach with `Ctrl+A then D`
- Don't type `exit` unless you want to close the window
- Screen only keeps sessions that are detached, not exited

## Advanced Configuration

### Customize .screenrc

The screen configuration is in `/home/opencode/.screenrc`.

You can modify it to:
- Change the command prefix (default: Ctrl+A)
- Customize the status line
- Set default number of windows
- Configure key bindings

Example customizations:

```bash
# Change prefix to Ctrl+J (easier on iPhone)
escape ^Jj

# Start with 3 windows
screen -t work 1
screen -t test 2
screen -t logs 3

# Bind function keys
bindkey -k k1 select 1
bindkey -k k2 select 2
```

### Alternative: tmux

If you prefer tmux over screen:

```bash
# tmux is also installed in the container
# Create session
tmux new -s opencode-main

# Detach: Ctrl+B then D
# Attach: tmux attach -t opencode-main
# List: tmux ls
```

tmux benefits:
- More modern design
- Better split-pane support
- More customizable

screen benefits:
- Simpler to learn
- More widely available
- Lighter weight

## Best Practices

1. **Always detach, never exit**: Use `Ctrl+A then D` to leave sessions running
2. **Name your windows**: Makes switching easier with multiple windows
3. **One session per project**: Create different sessions for different projects
4. **Use scrollback**: `Ctrl+A then [` to review command output
5. **Learn the basics well**: Master attach, detach, and window switching before advanced features

## Resources

- [GNU Screen Manual](https://www.gnu.org/software/screen/manual/screen.html)
- [Screen Quick Reference](http://aperiodic.net/screen/quick_reference)
- [Screen User Guide](https://linuxize.com/post/how-to-use-linux-screen/)

## See Also

- [Tailscale Setup Guide](tailscale-setup.md) - Setting up remote SSH access
- [README](../README.md) - General OpenCode documentation
