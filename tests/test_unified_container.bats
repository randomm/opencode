#!/usr/bin/env bats
# Tests for Unified OpenCode Container
# These tests verify the container builds, runs, and provides all required features

setup() {
    # Configuration
    export CONFIG_DIR="/Users/janni/.config/opencode"
    export COMPOSE_FILE="$CONFIG_DIR/docker-compose.yml"
    export DOCKERFILE="$CONFIG_DIR/Dockerfile.opencode-unified"
    export HELPER_SCRIPT="$CONFIG_DIR/scripts/opencode"
    
    # Test container name
    export CONTAINER_NAME="opencode"
    
    # Load test environment if exists
    if [[ -f "$CONFIG_DIR/.env.test" ]]; then
        source "$CONFIG_DIR/.env.test"
    fi
}

teardown() {
    # Clean up test containers after each test
    # (Comment out if you want to inspect failed state)
    # docker compose -f "$COMPOSE_FILE" down --volumes 2>/dev/null || true
    :
}

# ===========================================================================
# Build Tests
# ===========================================================================

@test "Dockerfile.opencode-unified exists" {
    [[ -f "$DOCKERFILE" ]]
}

@test "Docker builds successfully" {
    run docker build -t opencode-unified:test -f "$DOCKERFILE" "$CONFIG_DIR"
    [[ "$status" -eq 0 ]]
}

@test "Docker build includes openssh-server" {
    docker build -t opencode-unified:test -f "$DOCKERFILE" "$CONFIG_DIR" 2>&1 | \
        grep -q "openssh-server"
}

@test "Docker build includes screen" {
    docker build -t opencode-unified:test -f "$DOCKERFILE" "$CONFIG_DIR" 2>&1 | \
        grep -q "screen"
}

@test "Docker build includes gh CLI" {
    docker build -t opencode-unified:test -f "$DOCKERFILE" "$CONFIG_DIR" 2>&1 | \
        grep -q "gh"
}

# ===========================================================================
# Container Runtime Tests
# ===========================================================================

@test "Container starts successfully" {
    cd "$CONFIG_DIR"
    run docker compose -f "$COMPOSE_FILE" up -d opencode
    [[ "$status" -eq 0 ]]
    
    # Wait for container to be ready
    sleep 3
    
    # Verify container is running
    docker ps --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | grep -q "$CONTAINER_NAME"
}

@test "SSH daemon is running in container" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check if sshd process is running
    run docker exec "$CONTAINER_NAME" pgrep -f "/usr/sbin/sshd"
    [[ "$status" -eq 0 ]]
}

@test "Screen session auto-created" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 5
    
    # Check if screen session exists
    run docker exec "$CONTAINER_NAME" screen -ls
    [[ "$output" =~ "opencode-main" ]]
}

@test "OpenCode CLI is installed" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check OpenCode version
    run docker exec "$CONTAINER_NAME" su - opencode -c "opencode --version"
    [[ "$status" -eq 0 ]]
}

@test "Docker socket is accessible" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Test docker ps from inside container
    run docker exec "$CONTAINER_NAME" su - opencode -c "docker ps"
    [[ "$status" -eq 0 ]]
}

@test "gh CLI is installed" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check gh version
    run docker exec "$CONTAINER_NAME" su - opencode -c "gh --version"
    [[ "$status" -eq 0 ]]
}

@test "User opencode exists with UID 1001" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Verify user ID
    run docker exec "$CONTAINER_NAME" id -u opencode
    [[ "$output" == "1001" ]]
}

@test "History files exist and are writable" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check bash history
    run docker exec "$CONTAINER_NAME" su - opencode -c "test -f ~/.bash_history && test -w ~/.bash_history"
    [[ "$status" -eq 0 ]]
    
    # Check zsh history
    run docker exec "$CONTAINER_NAME" su - opencode -c "test -f ~/.zsh_history && test -w ~/.zsh_history"
    [[ "$status" -eq 0 ]]
}

# ===========================================================================
# Helper Script Tests
# ===========================================================================

@test "Helper script exists and is executable" {
    [[ -f "$HELPER_SCRIPT" ]]
    [[ -x "$HELPER_SCRIPT" ]]
}

@test "Helper script passes shellcheck" {
    run shellcheck "$HELPER_SCRIPT"
    [[ "$status" -eq 0 ]]
}

@test "Helper script detects running container" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Run helper script with --status flag (to be implemented)
    run "$HELPER_SCRIPT" --status
    [[ "$output" =~ "running" ]] || [[ "$status" -eq 0 ]]
}

# ===========================================================================
# Docker Compose Tests
# ===========================================================================

@test "docker-compose.yml exists" {
    [[ -f "$COMPOSE_FILE" ]]
}

@test "docker-compose.yml is valid" {
    cd "$CONFIG_DIR"
    run docker compose -f "$COMPOSE_FILE" config
    [[ "$status" -eq 0 ]]
}

@test "Compose includes opencode service" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" config | grep -q "opencode:"
}

@test "Compose includes tailscale service" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" config | grep -q "tailscale:"
}

# ===========================================================================
# Security Tests
# ===========================================================================

@test "SSH password authentication is disabled" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check sshd_config
    run docker exec "$CONTAINER_NAME" grep "PasswordAuthentication no" /etc/ssh/sshd_config
    [[ "$status" -eq 0 ]]
}

@test "SSH root login is disabled" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check sshd_config
    run docker exec "$CONTAINER_NAME" grep "PermitRootLogin no" /etc/ssh/sshd_config
    [[ "$status" -eq 0 ]]
}

@test "opencode user is in docker group" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check group membership
    run docker exec "$CONTAINER_NAME" groups opencode
    [[ "$output" =~ "docker" ]]
}

# ===========================================================================
# Session Management Tests
# ===========================================================================

@test ".screenrc exists in container" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check for .screenrc
    run docker exec "$CONTAINER_NAME" su - opencode -c "test -f ~/.screenrc"
    [[ "$status" -eq 0 ]]
}

@test "Can attach to screen session via docker exec" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 5
    
    # Try to list screen sessions (should show opencode-main)
    run docker exec "$CONTAINER_NAME" su - opencode -c "screen -ls"
    [[ "$output" =~ "opencode-main" ]]
}

# ===========================================================================
# Integration Tests
# ===========================================================================

@test "Entrypoint script exists and is executable" {
    [[ -f "$CONFIG_DIR/entrypoint-unified.sh" ]]
    [[ -x "$CONFIG_DIR/entrypoint-unified.sh" ]]
}

@test "Entrypoint script passes shellcheck" {
    run shellcheck "$CONFIG_DIR/entrypoint-unified.sh"
    [[ "$status" -eq 0 ]]
}

@test "Container stays running after startup" {
    cd "$CONFIG_DIR"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 5
    
    # Check container is still running
    run docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}"
    [[ "$output" =~ "Up" ]]
}

@test "gh CLI can authenticate with GH_TOKEN" {
    skip "Requires GH_TOKEN in environment"
    
    cd "$CONFIG_DIR"
    export GH_TOKEN="test-token"
    docker compose -f "$COMPOSE_FILE" up -d opencode
    sleep 3
    
    # Check if gh is authenticated (will fail with test token, but should try)
    docker exec "$CONTAINER_NAME" su - opencode -c "gh auth status" || true
}
