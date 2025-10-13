#!/usr/bin/env zsh
# OpenCode Backspace Emergency Fix
# Run this in the SSH session to attempt immediate fixes

echo "🔧 BACKSPACE EMERGENCY FIX SEQUENCE"
echo "===================================="
echo ""

# Theory 1: ZLE not properly initialized
echo "1️⃣ Initializing ZLE and completion..."
autoload -U compinit && compinit
autoload -U colors && colors
echo "✓ ZLE initialized"
echo ""

# Theory 2: Wrong keymap mode
echo "2️⃣ Setting emacs keymap mode..."
bindkey -e
echo "✓ Emacs mode set"
echo ""

# Theory 3: Keybindings not applied
echo "3️⃣ Applying backspace keybindings..."
bindkey '^?' backward-delete-char
bindkey '^H' backward-delete-char
bindkey '^[[3~' delete-char
echo "✓ Keybindings applied"
echo ""

# Theory 4: stty erase not set
echo "4️⃣ Setting terminal erase character..."
stty erase $'\x7f'
echo "✓ stty erase set to DEL (127)"
echo ""

# Verification
echo "5️⃣ VERIFICATION"
echo "--------------"
echo "Current stty erase: $(stty -a | grep -o 'erase = [^;]*')"
echo "Current ^? binding: $(bindkey '^?' 2>&1)"
echo "Current ^H binding: $(bindkey '^H' 2>&1)"
echo ""

echo "✅ All fixes applied!"
echo ""
echo "TEST NOW: Try pressing backspace in this terminal."
echo "If it works, add this to investigate why .zshrc didn't apply these settings."
echo ""

# Check if .zshrc is actually being sourced
if [ -f ~/.zshrc ]; then
    echo "📄 Your .zshrc exists ($(stat -f%z ~/.zshrc 2>/dev/null || stat -c%s ~/.zshrc 2>/dev/null) bytes)"
    echo "First 10 lines:"
    head -10 ~/.zshrc
    echo ""
    echo "💡 If backspace works NOW but didn't before:"
    echo "   → .zshrc might not be sourced on login"
    echo "   → Or something is overriding it after sourcing"
else
    echo "⚠️  WARNING: ~/.zshrc does not exist!"
    echo "   → This is the problem - no config file to set keybindings"
fi
echo ""
