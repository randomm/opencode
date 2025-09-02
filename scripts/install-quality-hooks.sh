#!/usr/bin/env bash

# Installation script for quality gate bypass prevention hooks
# This script installs the pre-commit hook in your git repository

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/prevent-quality-bypass.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Quality Gate Bypass Prevention - Hook Installer${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    echo "Please run this script from within a git repository"
    exit 1
fi

GIT_ROOT=$(git rev-parse --show-toplevel)
HOOKS_DIR="$GIT_ROOT/.git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

echo "📁 Git repository: $GIT_ROOT"
echo "🔗 Hooks directory: $HOOKS_DIR"
echo ""

# Check if pre-commit hook already exists
if [ -f "$PRE_COMMIT_HOOK" ]; then
    echo -e "${YELLOW}⚠️  Warning: pre-commit hook already exists${NC}"
    echo ""
    echo "Options:"
    echo "  1. Backup existing and install new hook"
    echo "  2. Append quality checks to existing hook"
    echo "  3. Cancel installation"
    echo ""
    read -p "Choose option (1/2/3): " choice
    
    case $choice in
        1)
            BACKUP_FILE="$PRE_COMMIT_HOOK.backup.$(date +%Y%m%d_%H%M%S)"
            mv "$PRE_COMMIT_HOOK" "$BACKUP_FILE"
            echo -e "${GREEN}✅ Existing hook backed up to: $BACKUP_FILE${NC}"
            ;;
        2)
            echo "" >> "$PRE_COMMIT_HOOK"
            echo "# Quality Gate Bypass Prevention" >> "$PRE_COMMIT_HOOK"
            echo "bash $HOOK_SCRIPT" >> "$PRE_COMMIT_HOOK"
            echo -e "${GREEN}✅ Quality checks appended to existing hook${NC}"
            exit 0
            ;;
        3)
            echo -e "${YELLOW}Installation cancelled${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            exit 1
            ;;
    esac
fi

# Create the pre-commit hook
cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/usr/bin/env bash
# Pre-commit hook for quality gate bypass prevention

# Execute the quality gate bypass prevention script
EOF

echo "bash $HOOK_SCRIPT" >> "$PRE_COMMIT_HOOK"

# Make the hook executable
chmod +x "$PRE_COMMIT_HOOK"

echo -e "${GREEN}✅ Pre-commit hook installed successfully!${NC}"
echo ""
echo "The hook will now prevent:"
echo "  • Adding # noqa or # type: ignore comments"
echo "  • Modifying linter configurations to add ignores"
echo "  • Skipping tests instead of fixing them"
echo "  • Other quality gate bypass attempts"
echo ""

# Check for pre-commit framework
if [ -f "$GIT_ROOT/.pre-commit-config.yaml" ]; then
    echo -e "${YELLOW}📝 Note: You have a .pre-commit-config.yaml file${NC}"
    echo "Consider adding this as a pre-commit framework hook instead."
    echo ""
    echo "Add to .pre-commit-config.yaml:"
    echo "  - repo: local"
    echo "    hooks:"
    echo "      - id: prevent-quality-bypass"
    echo "        name: Prevent Quality Gate Bypass"
    echo "        entry: bash $HOOK_SCRIPT"
    echo "        language: system"
    echo "        pass_filenames: false"
    echo ""
fi

# Offer to test the hook
echo -e "${BLUE}Would you like to test the hook now? (y/n)${NC}"
read -p "> " test_choice

if [[ "$test_choice" == "y" || "$test_choice" == "Y" ]]; then
    echo ""
    echo "Testing hook with a sample violation..."
    
    # Create a temporary test file
    TEST_FILE="$GIT_ROOT/test_quality_bypass.py"
    echo "# Test file" > "$TEST_FILE"
    echo "result = complex_calculation()  # noqa" >> "$TEST_FILE"
    
    git add "$TEST_FILE"
    
    echo ""
    if ! git commit -m "Test commit" 2>/dev/null; then
        echo -e "${GREEN}✅ Hook is working! It correctly blocked the commit with quality bypass${NC}"
    else
        echo -e "${RED}❌ Hook may not be working properly${NC}"
    fi
    
    # Clean up
    git reset HEAD "$TEST_FILE" 2>/dev/null
    rm -f "$TEST_FILE"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Installation complete! Your code quality is now protected.${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"