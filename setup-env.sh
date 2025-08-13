#!/bin/bash

# OpenCode Environment Setup Script
# This script helps you set up environment variables for OpenCode

echo "OpenCode Environment Configuration Setup"
echo "========================================"
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "Loading existing .env file..."
    set -a
    source .env
    set +a
    echo "✓ Loaded .env file"
else
    echo "No .env file found. Creating from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✓ Created .env from .env.example"
        echo ""
        echo "⚠️  Please edit .env file with your actual credentials"
        echo "   Run: nano .env"
        exit 1
    else
        echo "❌ No .env.example file found"
        exit 1
    fi
fi

# Export to shell profile
echo ""
echo "Choose your shell profile to update:"
echo "1) ~/.zshrc (macOS default)"
echo "2) ~/.bashrc"
echo "3) ~/.bash_profile"
echo "4) Skip shell profile update"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        PROFILE="$HOME/.zshrc"
        ;;
    2)
        PROFILE="$HOME/.bashrc"
        ;;
    3)
        PROFILE="$HOME/.bash_profile"
        ;;
    4)
        echo "Skipping shell profile update"
        PROFILE=""
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

if [ -n "$PROFILE" ]; then
    # Check if OpenCode env section already exists
    if grep -q "# OpenCode Environment Variables" "$PROFILE" 2>/dev/null; then
        echo "✓ OpenCode environment section already exists in $PROFILE"
    else
        echo "" >> "$PROFILE"
        echo "# OpenCode Environment Variables" >> "$PROFILE"
        echo "if [ -f ~/.config/opencode/.env ]; then" >> "$PROFILE"
        echo "    set -a" >> "$PROFILE"
        echo "    source ~/.config/opencode/.env" >> "$PROFILE"
        echo "    set +a" >> "$PROFILE"
        echo "fi" >> "$PROFILE"
        echo "✓ Added OpenCode environment configuration to $PROFILE"
    fi
fi

# Verify environment variables are set
echo ""
echo "Verifying environment variables..."
echo ""

check_var() {
    if [ -z "${!1}" ]; then
        echo "❌ $1 is not set"
        return 1
    else
        # Show first 4 and last 4 characters only for security
        value="${!1}"
        if [ ${#value} -gt 10 ]; then
            masked="${value:0:4}...${value: -4}"
        else
            masked="***"
        fi
        echo "✓ $1 is set ($masked)"
        return 0
    fi
}

all_good=true
check_var "PERPLEXITY_API_KEY" || all_good=false
check_var "FUZU_METABASE_DB_URL" || all_good=false
check_var "FUZU_PRODUCTION_DB_URL" || all_good=false
check_var "FUZU_STAGING_DB_URL" || all_good=false
check_var "BARONA_PRODUCTION_DB_URL" || all_good=false

echo ""
if $all_good; then
    echo "✅ All required environment variables are configured!"
    echo ""
    echo "To activate the secure configuration:"
    echo "  1. Backup current config: mv opencode.json opencode.json.backup"
    echo "  2. Use secure config: cp opencode.json.secure opencode.json"
    echo "  3. Restart your shell or run: source $PROFILE"
else
    echo "⚠️  Some environment variables are missing."
    echo "Please edit .env file with your actual credentials:"
    echo "  nano .env"
fi