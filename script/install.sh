#!/bin/bash
set -euo pipefail

# Install and verify opencode binary with proper error handling
# Usage: ./script/install.sh

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY_SOURCE=""
BIN_DIR="${HOME}/bin"
BIN_DEST="${BIN_DIR}/opencode-new"
BIN_BACKUP="${BIN_DIR}/opencode-new.backup"
TEMP_DEST=""

# Cleanup temp files on exit
cleanup() {
  if [[ -n "$TEMP_DEST" && -f "$TEMP_DEST" ]]; then
    rm -f "$TEMP_DEST"
  fi
}
trap cleanup EXIT

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_error() {
  echo -e "${RED}ERROR: $*${NC}" >&2
}

log_success() {
  echo -e "${GREEN}✓ $*${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠ $*${NC}"
}

log_info() {
  echo -e "${YELLOW}→ $*${NC}"
}

# Step 1: Detect platform and architecture
log_info "Detecting platform..."
case "$(uname -s)" in
  Darwin)
    case "$(uname -m)" in
      arm64) PLATFORM="darwin-arm64" ;;
      x86_64) PLATFORM="darwin-x64" ;;
      *) log_error "Unsupported macOS architecture: $(uname -m)"; exit 1 ;;
    esac
    ;;
  Linux)
    case "$(uname -m)" in
      x86_64) PLATFORM="linux-x64" ;;
      aarch64) PLATFORM="linux-arm64" ;;
      *) log_error "Unsupported Linux architecture: $(uname -m)"; exit 1 ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*)
    case "$(uname -m)" in
      x86_64) PLATFORM="windows-x64" ;;
      aarch64) PLATFORM="windows-arm64" ;;
      *) log_error "Unsupported Windows architecture: $(uname -m)"; exit 1 ;;
    esac
    ;;
  *)
    log_error "Unsupported platform: $(uname -s)"
    exit 1
    ;;
esac
log_success "Platform: $PLATFORM"

BINARY_SOURCE="${REPO_ROOT}/packages/opencode/dist/opencode-${PLATFORM}/bin/opencode"

# Step 2: Verify binary was built
log_info "Verifying binary build..."
if [[ ! -f "$BINARY_SOURCE" ]]; then
  log_error "Binary not found at: $BINARY_SOURCE"
  log_error "Did you run: cd packages/opencode && bun run build --single"
  exit 1
fi

# Resolve symlinks and verify the binary is at expected location (prevent symlink injection)
BINARY_RESOLVED=$(cd "$(dirname "$BINARY_SOURCE")" && pwd -P)/$(basename "$BINARY_SOURCE")
if [[ ! -f "$BINARY_RESOLVED" ]]; then
  log_error "Binary symlink resolves to non-existent file: $BINARY_RESOLVED"
  exit 1
fi
if [[ "$BINARY_RESOLVED" != "$REPO_ROOT"/packages/opencode/dist/opencode-* ]]; then
  log_error "Binary symlink resolves outside expected directory: $BINARY_RESOLVED"
  exit 1
fi

if [[ ! -x "$BINARY_RESOLVED" ]]; then
  log_error "Binary is not executable: $BINARY_RESOLVED"
  chmod +x "$BINARY_RESOLVED"
  log_success "Made binary executable"
fi

# Verify binary size (should be > 10MB) using POSIX portable method
BINARY_SIZE=$(wc -c < "$BINARY_RESOLVED" || {
  log_error "Failed to determine binary size"
  exit 1
})
if (( BINARY_SIZE < 10485760 )); then
  log_error "Binary suspiciously small: $(( BINARY_SIZE / 1048576 ))MB (expected > 10MB)"
  log_error "Build may have failed silently"
  exit 1
fi
log_success "Binary size: $(( BINARY_SIZE / 1048576 ))MB"

# Use resolved path from now on (prevents TOCTOU attacks)
BINARY_SOURCE="$BINARY_RESOLVED"

# Step 3: Verify installation directory
log_info "Verifying installation directory..."
if [[ ! -d "$BIN_DIR" ]]; then
  log_warning "Creating $BIN_DIR..."
  mkdir -p "$BIN_DIR" || {
    log_error "Failed to create directory: $BIN_DIR"
    exit 1
  }
fi

if [[ ! -w "$BIN_DIR" ]]; then
  log_error "$BIN_DIR is not writable"
  exit 1
fi
log_success "Installation directory ready: $BIN_DIR"

# Step 4: Backup existing candidate binary (if present)
if [[ -f "$BIN_DEST" ]]; then
  log_info "Backing up existing candidate binary..."
  if ! cp "$BIN_DEST" "$BIN_BACKUP"; then
    log_error "Failed to backup existing candidate binary"
    exit 1
  fi
  log_success "Backed up to: $BIN_BACKUP"
fi

# Step 5: Install binary (atomic copy with mktemp for security)
log_info "Installing binary..."
TEMP_DEST=$(mktemp "${BIN_DEST}.XXXXXX") || {
  log_error "Failed to create secure temp file"
  exit 1
}

# Copy binary to temp file
if ! cp "$BINARY_SOURCE" "$TEMP_DEST"; then
  log_error "Failed to copy binary"
  exit 1
fi

# Verify copy was successful by re-checking size (prevent TOCTOU)
TEMP_SIZE=$(wc -c < "$TEMP_DEST" || echo 0)
if [[ "$TEMP_SIZE" -ne "$BINARY_SIZE" ]]; then
  log_error "Binary size mismatch after copy: got $TEMP_SIZE, expected $BINARY_SIZE"
  exit 1
fi

if ! chmod +x "$TEMP_DEST"; then
  log_error "Failed to make binary executable"
  exit 1
fi

# Atomic move (rename is atomic on POSIX systems)
if ! mv "$TEMP_DEST" "$BIN_DEST"; then
  log_error "Failed to install binary (atomic move failed)"
  exit 1
fi
log_success "Binary installed: $BIN_DEST"

# Step 6: Codesign on macOS (critical for binary execution)
if [[ "$PLATFORM" == darwin-* ]]; then
  log_info "Codesigning binary for macOS..."
  if ! codesign --force --deep --sign - "$BIN_DEST"; then
    log_error "Codesigning failed - binary will not execute"
    log_info "Attempting rollback..."
    if [[ -f "$BIN_BACKUP" ]]; then
      cp "$BIN_BACKUP" "$BIN_DEST"
      # Verify restored binary is codesigned before declaring success
      if ! codesign -v "$BIN_DEST" &>/dev/null; then
        log_error "Restored backup is not codesigned - rollback failed"
        exit 1
      fi
      log_info "Restored previous binary from backup (verified codesigned)"
    fi
    exit 1
  fi
  log_success "Codesigning complete"
fi

# Step 7: Verify installation
log_info "Verifying installation..."
if [[ ! -f "$BIN_DEST" ]]; then
  log_error "Binary not found at: $BIN_DEST"
  exit 1
fi

# Verify version command works
if ! OPENCODE_VERSION=$("$BIN_DEST" --version 2>&1); then
  log_error "Failed to run: opencode --version"
  if [[ -f "$BIN_BACKUP" ]]; then
    log_info "Restoring previous binary..."
    cp "$BIN_BACKUP" "$BIN_DEST"
  fi
  exit 1
fi
log_success "Version: $OPENCODE_VERSION"

# Verify binary is executable by checking architecture
if [[ "$PLATFORM" == darwin-* ]]; then
  # Properly quote and escape command substitution to prevent injection
  ARCH="$(file "$BIN_DEST" | grep -o 'Mach-O[[:space:]]*[^[:space:]]*[[:space:]]*executable' || echo 'unknown')"
  log_success "Binary type: $ARCH"
fi

log_success "Installation complete!"
echo ""
echo "Candidate binary installed at: $BIN_DEST"

if [[ -f "${BIN_DIR}/opencode" ]]; then
  echo "Stable binary preserved at: ${BIN_DIR}/opencode"
  echo ""
  echo "To promote the candidate:"
else
  echo ""
  echo "This is your first opencode installation!"
  echo ""
  echo "To complete installation:"
fi

echo "  1. Test the new binary: $BIN_DEST --version"
echo "  2. If satisfied: mv $BIN_DEST ${BIN_DIR}/opencode"
echo ""
