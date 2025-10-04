# OpenCode Usage

## Start
```bash
cd ~/.config/opencode
docker compose up -d
```

## Use from Mac
```bash
docker exec -it -u opencode opencode screen -r opencode-main
```

## Use from iPhone
```bash
ssh opencode@100.65.79.62
screen -r opencode-main
```

## Detach from screen
Press: `Ctrl+A` then `D`

## Stop
```bash
cd ~/.config/opencode
docker compose down
```
