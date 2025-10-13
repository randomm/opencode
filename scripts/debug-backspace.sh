#!/usr/bin/env bash
# OpenCode Backspace Debugging Script
# Run this inside the SSH session where backspace doesn't work

echo "========================================="
echo "OPENCODE BACKSPACE DEBUGGING REPORT"
echo "========================================="
echo ""

echo "1. ENVIRONMENT CHECK"
echo "-------------------"
echo "SHELL: $SHELL"
echo "TERM: $TERM"
echo "STY (screen): $STY"
echo "ZLE_STATE: $ZLE_STATE"
echo "ZDOTDIR: $ZDOTDIR"
echo "HOME: $HOME"
echo ""

echo "2. CONFIG FILES PRESENT"
echo "----------------------"
for f in ~/.zshrc ~/.zshenv ~/.zprofile ~/.zlogin ~/.screenrc; do
    if [ -f "$f" ]; then
        size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
        echo "✓ $f ($size bytes)"
    else
        echo "✗ $f (missing)"
    fi
done
echo ""

echo "3. CURRENT TTY SETTINGS"
echo "----------------------"
stty -a
echo ""

echo "4. ZSH KEYBINDINGS CHECK"
echo "-----------------------"
if command -v bindkey &>/dev/null; then
    echo "Backspace-related bindings:"
    bindkey | grep -E "delete|erase" | head -10
    echo ""
    echo "Specific ^? binding:"
    bindkey '^?' 2>&1 || echo "ERROR: bindkey '^?' failed"
    echo ""
    echo "Specific ^H binding:"
    bindkey '^H' 2>&1 || echo "ERROR: bindkey '^H' failed"
else
    echo "ERROR: bindkey command not found (not in zsh?)"
fi
echo ""

echo "5. ZLE WIDGETS AVAILABLE"
echo "-----------------------"
if command -v zle &>/dev/null; then
    zle -la | grep -E "delete|backward" | head -10
else
    echo "ERROR: zle command not found"
fi
echo ""

echo "6. KEYMAP MODE"
echo "-------------"
if command -v bindkey &>/dev/null; then
    bindkey -lL 2>&1 || echo "Current keymap: $(bindkey -lL 2>&1)"
fi
echo ""

echo "7. ACTUAL .zshrc CONTENT (first 20 lines)"
echo "----------------------------------------"
head -20 ~/.zshrc 2>&1
echo ""

echo "8. TEST: Manual Keybinding"
echo "-------------------------"
echo "Attempting to set bindkey manually..."
if command -v bindkey &>/dev/null; then
    bindkey '^?' backward-delete-char 2>&1
    echo "✓ Manual bindkey set"
    echo "Current ^? binding after manual set:"
    bindkey '^?' 2>&1
else
    echo "ERROR: Cannot set bindkey (not in zsh)"
fi
echo ""

echo "9. TERMINFO CHECK"
echo "----------------"
echo "Current TERM: $TERM"
infocmp "$TERM" 2>&1 | grep -E "kbs|kdch" | head -5 || echo "No terminfo for $TERM"
echo ""

echo "10. SCREEN SESSION CHECK"
echo "-----------------------"
if [ -n "$STY" ]; then
    echo "✓ Inside screen session: $STY"
    echo "Screen term: $TERM"
    screen -v 2>&1 | head -1
else
    echo "✗ Not in a screen session"
fi
echo ""

echo "========================================="
echo "INTERACTIVE TESTS"
echo "========================================="
echo ""
echo "Test 1: Press backspace key now, then press Enter:"
read -r test_input
echo "You entered: [$test_input]"
echo ""

echo "Test 2: Raw character detection"
echo "Press backspace key, then Ctrl+D:"
echo -n "Input: "
char=$(dd bs=1 count=1 2>/dev/null | od -An -t d1)
echo ""
echo "Character code received: $char"
if [ "$char" = " 127" ]; then
    echo "✓ Backspace sends DEL (127) - CORRECT"
elif [ "$char" = "   8" ]; then
    echo "⚠ Backspace sends BS (8) - unexpected"
else
    echo "✗ Backspace sends: $char - UNEXPECTED"
fi
echo ""

echo "========================================="
echo "DIAGNOSIS COMPLETE"
echo "========================================="
echo ""
echo "Save this output and share with debugging team."
echo ""
