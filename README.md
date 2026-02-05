<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/solomemory-ai/.github/main/brand/logo-mark-white-transparent.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/solomemory-ai/.github/main/brand/logo-mark-black-transparent.png">
  <img src="https://raw.githubusercontent.com/solomemory-ai/.github/main/brand/logo-mark-black-transparent.png" alt="Solo Memory" width="120">
</picture>

# opencode-solomemory

[![npm version](https://img.shields.io/npm/v/oc-solomemory?color=blue&label=stable)](https://www.npmjs.com/package/oc-solomemory)
[![npm dev](https://img.shields.io/npm/v/oc-solomemory/dev?color=orange&label=dev)](https://www.npmjs.com/package/oc-solomemory?activeTab=versions)
[![npm downloads](https://img.shields.io/npm/dm/oc-solomemory)](https://www.npmjs.com/package/oc-solomemory)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e1?logo=bun&logoColor=black)](https://bun.sh)

Persistent memory plugin for [OpenCode](https://opencode.ai) — powered by [Solo Memory](https://solomemory.com).

Your AI agent remembers what you tell it — across sessions, across projects.

---

## Features

- **Context injection** — Agent automatically receives your preferences and project knowledge at the start of every session
- **Conversation sync** — Conversations are synced to Solo Memory, building long-term knowledge
- **Memory scoping** — Memories are scoped to user, project, repo, and branch levels
- **Keyword detection** — Say "remember this" and it saves to memory
- **Codebase indexing** — Run `/solomemory-init` to memorize your codebase structure

## Quick Start

```bash
npx oc-solomemory@latest install
export SOLOMEMORY_API_KEY="your-api-key"
```

For the latest dev build:

```bash
npx oc-solomemory@dev install
```

Get your API key at [solomemory.com](https://solomemory.com).

## How It Works

```
Session starts → Plugin fetches your profile + relevant memories → Injects into agent context
         ↓
Agent works → Session ends → Conversation synced to Solo Memory
         ↓
Next session → Agent knows what you discussed before
```

Memories are automatically scoped:

| Scope       | What it remembers                    | Example                             |
| ----------- | ------------------------------------ | ----------------------------------- |
| **User**    | Your preferences across all projects | "Prefers TypeScript strict mode"    |
| **Project** | Project-specific context             | "Uses Bun, not Node"                |
| **Repo**    | Repository knowledge                 | "Auth uses JWT with refresh tokens" |
| **Branch**  | Branch-specific work                 | "Working on dark mode feature"      |

## Configuration

Optional. Create `~/.config/opencode/solomemory.jsonc`:

```jsonc
{
  "apiKey": "your-api-key",
  "maxMemories": 5,
  "maxProjectMemories": 10,
  "maxProfileItems": 5,
  "injectProfile": true,
  "autoSyncConversations": true,
}
```

See [docs/CONFIG.md](docs/CONFIG.md) for all options.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE)
