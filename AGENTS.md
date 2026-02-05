# OPENCODE-SOLOMEMORY PLUGIN

**Generated:** 2026-02-05

## OVERVIEW

OpenCode AI plugin. Syncs conversations to solomemory-api, injects user profile + relevant memories into context. Bun runtime, TypeScript strict.

## STRUCTURE

```
opencode-solomemory/
├── src/
│   ├── index.ts           # Entry: hooks + tool definition (506 LOC)
│   ├── config.ts          # Config resolution via Proxy (env > jsonc > credentials > defaults)
│   ├── cli.ts             # CLI installer + auth commands (559 LOC, separate build target)
│   ├── types/
│   │   └── index.ts       # Shared interfaces: Result<T,E>, Memory, ConversationMessage
│   └── services/          # 8 service modules (~1270 LOC total, see services/AGENTS.md)
├── docs/
│   ├── CONFIG.md          # Full config reference
│   └── RELEASE.md         # Release process
├── scripts/
│   └── release.sh         # Version bump + publish (patch|minor|major)
└── .github/workflows/
    └── release.yml        # npm publish on v* tags with provenance
```

## WHERE TO LOOK

| Task                  | Location                               | Notes                                             |
| --------------------- | -------------------------------------- | ------------------------------------------------- |
| Add hook              | `src/index.ts`                         | Register in plugin hooks object + opencode config |
| Add tool mode         | `src/index.ts`                         | Switch case in `solomemory` tool handler          |
| Add API endpoint      | `src/services/client.ts`               | New method + type guard + response type           |
| Change context format | `src/services/context.ts`              | `formatContextForPrompt()`                        |
| Add tag type          | `src/services/tags.ts`                 | New getter + add to `getTags()` return            |
| Change config option  | `src/config.ts` + `src/types/index.ts` | Add to RuntimeConfig, update defaults             |
| Add CLI command       | `src/cli.ts`                           | New case in main switch                           |
| Change privacy rules  | `src/services/privacy.ts`              | Regex patterns                                    |
| Modify sync behavior  | `src/index.ts`                         | `session.idle` event handler                      |

## CODE MAP

| Symbol                   | Type           | Location                  | Role                                                   |
| ------------------------ | -------------- | ------------------------- | ------------------------------------------------------ |
| `SolomemoryPlugin`       | const (Plugin) | `src/index.ts`            | Default export, plugin entry                           |
| `solomemoryClient`       | singleton      | `src/services/client.ts`  | All API communication                                  |
| `CONFIG`                 | Proxy          | `src/config.ts`           | Lazy-init config, accessed everywhere                  |
| `getTags`                | fn             | `src/services/tags.ts`    | Container tag generation (project, repo, branch, etc.) |
| `formatContextForPrompt` | fn             | `src/services/context.ts` | Memory → system prompt injection                       |
| `sessionSyncState`       | Map            | `src/index.ts`            | Incremental sync tracking per session                  |
| `injectedSessions`       | Set            | `src/index.ts`            | Prevents double-injection per session                  |

## HOOKS

| Hook                    | Trigger                        | Action                                                                                                           |
| ----------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `chat.message`          | First user message per session | Parallel fetch profile + user memories + project memories → inject as synthetic Part                             |
| `event:session.idle`    | Session idle                   | Incremental sync: extract new messages since `lastSyncedMessageIndex`, build metadata, call `ingestConversation` |
| `event:session.deleted` | Session deleted                | Clean up `sessionSyncState` + `injectedSessions` Maps                                                            |

## TOOL

`solomemory` tool with modes: `search` (query memories), `profile` (show user profile), `list` (list memories by scope), `help` (usage info).

## MEMORY SCOPING

| Scope   | Tag Source                              | Example                   |
| ------- | --------------------------------------- | ------------------------- |
| User    | `user` (hardcoded)                      | Cross-project preferences |
| Project | Workspace dir hash (sha256, 16 chars)   | `proj_a1b2c3d4e5f6`       |
| Repo    | Git remote URL (normalized)             | `github.com/org/repo`     |
| Branch  | Git branch name (sanitized, NOT hashed) | `branch_feat/auth`        |

## CONFIG RESOLUTION ORDER

`SOLOMEMORY_*` env vars > `~/.config/opencode/solomemory.jsonc` > `~/.config/opencode/credentials.json` > defaults

Key defaults: `similarityThreshold=0.6`, `maxMemories=5`, `maxProjectMemories=10`, `maxProfileItems=5`, `containerTagPrefix='opencode'`

## CONVENTIONS

- TypeScript strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`
- Bun runtime (not Node), ESNext target, bundler module resolution
- No linter/formatter configured — rely on `tsc --noEmit`
- Discriminated union results from API: `{ success: true, ... } | { success: false, error }`
- Privacy: `<private>` tags redacted before sending to API
- Auth: Bearer token, credentials at `~/.solomemory-opencode/credentials.json` (0o600)
- Config files at `~/.config/opencode/`
- Git operations via `execSync` (synchronous, no async git)
- Logging: async batched file logger to `~/.opencode-solomemory.log`
- Dual build targets: `src/index.ts` (plugin) + `src/cli.ts` (CLI binary)

## ANTI-PATTERNS

- **No `as any` / `@ts-ignore` / `@ts-expect-error`**
- **No auto git commits** — user controls version history
- **Never send user identity from client** — server derives it from auth token
- **`isUserOrAssistantMessage` is @deprecated** — use `isNonSyntheticMessage` instead
- Branch/workspace names are intentionally NOT hashed (readability over privacy)

## COMMANDS

```bash
bun install              # Install deps
bun run build            # bun build + tsc declarations
bun run typecheck        # tsc --noEmit (no tests exist)
bun dev                  # tsc --watch
```

## NOTES

- **No automated tests** — no jest/vitest, manual QA only
- CLI install command modifies opencode config AND creates slash commands (`/solomemory-init`, `/solomemory-login`)
- Release: `scripts/release.sh {patch|minor|major}` → git tag → GitHub Actions publishes to npm
- JSONC parser is hand-rolled state machine (handles comments, trailing commas, escaped quotes)
