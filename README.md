# opencode-solomemory

OpenCode plugin for persistent memory using [Solo Memory](https://solomemory.com).

Your agent remembers what you tell it - across sessions, across projects.

## Install

```bash
bunx opencode-solomemory@latest install
export SOLOMEMORY_API_KEY="your-api-key"
```

## What It Does

- **Context injection**: Agent automatically receives your preferences and project knowledge
- **Keyword detection**: Say "remember this" and it saves to memory
- **Codebase indexing**: Run `/solomemory-init` to memorize your codebase

## Configuration

Optional. Create `~/.config/opencode/solomemory.jsonc`:

```jsonc
{
  "apiKey": "your-api-key",
  "maxMemories": 5,
  "similarityThreshold": 0.6
}
```

Full options: [docs/CONFIG.md](docs/CONFIG.md)

## License

MIT
