# opencode

Opinionated AI coding agent for agentic workflows.

> Based on [OpenCode](https://github.com/anomalyco/opencode) by Anomaly Co (MIT License)

---

### What is this?

A lightweight fork of OpenCode optimized for single developers running agentic workflows. Think PM agents orchestrating specialist agents, with deep memory/context integration via [remory](https://github.com/randomm/remory).

**Philosophy:**

- Opinionated defaults over endless configuration
- Optimized for agentic orchestration patterns
- Lightweight - stripped of enterprise bloat
- Single developer friendly

---

### Installation

```bash
# Clone
git clone https://github.com/randomm/opencode.git
cd opencode

# Install dependencies
bun install

# Build
cd packages/opencode && bun run build

# Install binary (adjust path for your platform)
cp dist/opencode-darwin-arm64/bin/opencode ~/bin/

# Linux x64
# cp dist/opencode-linux-x64/bin/opencode ~/bin/
```

Make sure `~/bin` is in your `PATH`.

---

### Quick start

```bash
# Navigate to your project
cd my-project

# Start opencode
opencode
```

On first run, you'll be prompted to configure your AI provider. Set your API key:

```bash
export ANTHROPIC_API_KEY="sk-..."
# or
export OPENAI_API_KEY="sk-..."
```

---

### Configuration

Create `opencode.json` in your project root or `~/.config/opencode/config.json` for global settings.

```json
{
  "provider": {
    "anthropic": {
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

Key options:

- `provider` - AI provider configuration (anthropic, openai, etc.)
- `mcpServers` - MCP server integrations
- `instructions` - Custom system instructions

---

### Agents

Two built-in agents, switchable with `Tab`:

- **build** - Full access agent for development work (default)
- **plan** - Read-only agent for analysis and exploration

Use `@general` in messages to invoke the subagent for complex searches.

---

### Differences from upstream

This fork focuses on:

- **Agentic workflows** - Optimized for PM/specialist agent patterns
- **remory integration** - Deep memory and context management
- **Minimal footprint** - No desktop app, no VS Code extension, no npm publishing
- **Opinionated defaults** - Less configuration, more convention

Removed from upstream:

- Desktop application
- VS Code extension
- npm/brew/scoop publishing
- Enterprise features

---

### License

MIT License. See [LICENSE](./LICENSE).

---

### Attribution

This project is a fork of [OpenCode](https://github.com/anomalyco/opencode) by Anomaly Co, licensed under MIT. We're grateful for their work on the original project.
