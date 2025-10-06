# OpenCode Container - zsh configuration
# Ensures terminal compatibility for SSH access from Mac/iPhone

# Path setup
export PATH=/home/opencode/.opencode/bin:$PATH

# Terminal configuration for modern terminals (Mac Terminal.app, iTerm2, Blink, Termius)
# These terminals send ^? (DEL, ASCII 127) for backspace
stty erase ^?

# Explicit zsh key bindings for backspace compatibility
bindkey '^?' backward-delete-char  # DEL (modern terminals)
bindkey '^H' backward-delete-char  # BS (fallback for legacy terminals)
bindkey '^[[3~' delete-char        # Delete key (forward delete)

# Additional useful key bindings for better SSH experience
bindkey '^[[H' beginning-of-line   # Home key
bindkey '^[[F' end-of-line         # End key

# Fix TERM inside screen sessions
if [[ -n "$STY" ]] && [[ "$TERM" != "screen"* ]]; then
    export TERM=screen-256color
fi

# History configuration
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE

# Enable colors
autoload -U colors && colors

# Basic prompt (can be customized)
PROMPT='%F{green}%n@%m%f:%F{blue}%~%f$ '
