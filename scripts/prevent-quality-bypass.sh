#!/usr/bin/env bash

# Pre-commit hook to prevent quality gate bypasses
# This script detects and blocks attempts to suppress linting errors
# Install by copying to .git/hooks/pre-commit or using pre-commit framework

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking for quality gate bypass attempts..."

# Track if any violations are found
VIOLATIONS_FOUND=0
VIOLATION_DETAILS=""

# Function to add violation
add_violation() {
    VIOLATIONS_FOUND=1
    VIOLATION_DETAILS="${VIOLATION_DETAILS}\n  ❌ $1"
}

# Check for new suppression comments in Python files
echo "Checking Python files for suppressions..."
for file in $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true); do
    if [ -f "$file" ]; then
        # Check for noqa comments
        if git diff --cached "$file" | grep -E '^\+.*#\s*(noqa|NOQA)' > /dev/null 2>&1; then
            add_violation "Found '# noqa' in $file"
        fi
        
        # Check for type: ignore comments
        if git diff --cached "$file" | grep -E '^\+.*#\s*type:\s*ignore' > /dev/null 2>&1; then
            add_violation "Found '# type: ignore' in $file"
        fi
        
        # Check for pylint disable comments
        if git diff --cached "$file" | grep -E '^\+.*#\s*pylint:\s*disable' > /dev/null 2>&1; then
            add_violation "Found '# pylint: disable' in $file"
        fi
        
        # Check for fmt: off comments
        if git diff --cached "$file" | grep -E '^\+.*#\s*fmt:\s*off' > /dev/null 2>&1; then
            add_violation "Found '# fmt: off' in $file"
        fi
    fi
done

# Check for new suppressions in JavaScript/TypeScript files
echo "Checking JavaScript/TypeScript files for suppressions..."
for file in $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx|ts|tsx)$' || true); do
    if [ -f "$file" ]; then
        # Check for eslint-disable comments
        if git diff --cached "$file" | grep -E '^\+.*(//|/\*)\s*eslint-disable' > /dev/null 2>&1; then
            add_violation "Found 'eslint-disable' in $file"
        fi
        
        # Check for @ts-ignore comments
        if git diff --cached "$file" | grep -E '^\+.*//\s*@ts-ignore' > /dev/null 2>&1; then
            add_violation "Found '@ts-ignore' in $file"
        fi
        
        # Check for @ts-nocheck comments
        if git diff --cached "$file" | grep -E '^\+.*//\s*@ts-nocheck' > /dev/null 2>&1; then
            add_violation "Found '@ts-nocheck' in $file"
        fi
    fi
done

# Check for modifications to linter configuration files
echo "Checking for linter configuration modifications..."
CONFIG_FILES=".ruff.toml pyproject.toml setup.cfg .flake8 .pylintrc .eslintrc .eslintrc.js .eslintrc.json tslint.json"
for config in $CONFIG_FILES; do
    if git diff --cached --name-only | grep -q "^$config$"; then
        # Check if ignore lists are being modified
        if git diff --cached "$config" | grep -E '^\+.*(ignore|exclude|disable)' > /dev/null 2>&1; then
            add_violation "Modifying ignore/exclude lists in $config"
        fi
        
        # Check for adding to ignore patterns in TOML files
        if [[ "$config" == *.toml ]]; then
            if git diff --cached "$config" | grep -E '^\+.*ignore\s*=' > /dev/null 2>&1; then
                add_violation "Adding ignore rules in $config"
            fi
            if git diff --cached "$config" | grep -E '^\+.*"[A-Z]+[0-9]+"' > /dev/null 2>&1; then
                echo -e "${YELLOW}⚠️  Warning: Adding what appears to be error codes in $config - verify these aren't ignore rules${NC}"
            fi
        fi
    fi
done

# Check for pytest.skip or unittest.skip in test files
echo "Checking for skipped tests..."
for file in $(git diff --cached --name-only --diff-filter=ACM | grep -E 'test.*\.py$' || true); do
    if [ -f "$file" ]; then
        if git diff --cached "$file" | grep -E '^\+.*(pytest\.skip|unittest\.skip|@skip|@pytest\.mark\.skip)' > /dev/null 2>&1; then
            add_violation "Found test skip in $file"
        fi
    fi
done

# Report results
echo ""
if [ $VIOLATIONS_FOUND -eq 1 ]; then
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}❌ QUALITY GATE BYPASS ATTEMPT DETECTED!${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${RED}The following violations were found:${NC}"
    echo -e "$VIOLATION_DETAILS"
    echo ""
    echo -e "${RED}THESE ACTIONS ARE FORBIDDEN:${NC}"
    echo "  • Adding # noqa, # type: ignore, or similar suppression comments"
    echo "  • Modifying linter configs to add ignores or excludes"
    echo "  • Skipping tests instead of fixing them"
    echo ""
    echo -e "${GREEN}THE CORRECT APPROACH:${NC}"
    echo "  1. Understand why the linting error occurs"
    echo "  2. Fix the actual code issue"
    echo "  3. Ensure all quality checks pass"
    echo ""
    echo -e "${YELLOW}If you believe this is a false positive or exceptional case:${NC}"
    echo "  1. Document the specific reason in detail"
    echo "  2. Get explicit approval from senior review"
    echo "  3. Track as technical debt with a resolution timeline"
    echo ""
    echo -e "${RED}Commit blocked. Fix the issues and try again.${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    exit 1
else
    echo -e "${GREEN}✅ No quality gate bypass attempts detected${NC}"
fi

# Run additional quality checks if available
if command -v ruff &> /dev/null; then
    echo "Running ruff check..."
    if ! ruff check --diff $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true) 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Ruff found issues - fix them before committing${NC}"
        exit 1
    fi
fi

if command -v mypy &> /dev/null; then
    echo "Running mypy check..."
    PYTHON_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true)
    if [ -n "$PYTHON_FILES" ]; then
        if ! mypy $PYTHON_FILES 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Mypy found type issues - fix them before committing${NC}"
            exit 1
        fi
    fi
fi

echo -e "${GREEN}✅ All quality gate checks passed${NC}"
exit 0