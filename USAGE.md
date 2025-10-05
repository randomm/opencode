# OpenCode Usage

## Setup (First Time)
```bash
# Add oc command to PATH
ln -s ~/.config/opencode/scripts/oc ~/.local/bin/oc
```

## Start
```bash
cd ~/.config/opencode
docker compose up -d
```

## Use
```bash
oc  # from Mac (auto-creates session if needed)
```

From iPhone:
```bash
ssh opencode@100.65.79.62
screen -xRR opencode-main
```

## Detach
`Ctrl+A` then `D`

## Stop
```bash
cd ~/.config/opencode
docker compose down
```
