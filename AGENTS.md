# OPENCODE-SOLOMEMORY PLUGIN

**Generated:** 2026-02-08

## OVERVIEW

OpenCode AI plugin. Syncs conversations to solomemory-api, injects user profile + relevant memories into context. Bun runtime, TypeScript strict.

## STRUCTURE

```
opencode-solomemory/
├── src/
│   ├── index.ts           # Entry: hooks registration, context injection, session mgmt
│   ├── tools.ts           # Tool handler: solomemory tool modes (search, profile, list, help, projects)
│   ├── sync.ts            # Conversation sync: session.idle/compacted handlers, incremental sync
│   ├── state.ts           # Shared state: subagentSessions Set
│   ├── config.ts          # Config resolution via Proxy (env > jsonc > credentials > defaults)
│   ├── cli.ts             # CLI entry (delegates to cli/)
│   ├── cli/
│   │   ├── index.ts       # CLI command router (install, login, logout, status, help)
│   │   ├── install.ts     # Install command: config patching, slash commands
│   │   └── templates.ts   # AGENTS.md + config templates for install
│   ├── types/
│   │   └── index.ts       # Shared interfaces: Result<T,E>, Memory, ConversationMessage
│   └── services/          # 10 service modules (see services/AGENTS.md)
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
| Add tool mode         | `src/tools.ts`                         | Switch case in `executeTool()` handler            |
| Modify sync behavior  | `src/sync.ts`                          | `handleSessionIdle()`, `handleSessionCompacted()` |
| Add API endpoint      | `src/services/client.ts`               | New method + type in `client-types.ts`            |
| Change context format | `src/services/context.ts`              | `formatContextForPrompt()`                        |
| Add tag type          | `src/services/tags.ts`                 | New async getter + add to `getTags()` return      |
| Change config option  | `src/config.ts` + `src/types/index.ts` | Add to RuntimeConfig, update defaults             |
| Add CLI command       | `src/cli/index.ts`                     | New case in command router                        |
| Change privacy rules  | `src/services/privacy.ts`              | Regex patterns                                    |
| Workspace detection   | `src/services/workspace.ts`            | Walk-up directory search for project markers      |

## CODE MAP

| Symbol                   | Type           | Location                  | Role                                                   |
| ------------------------ | -------------- | ------------------------- | ------------------------------------------------------ |
| `SolomemoryPlugin`       | const (Plugin) | `src/index.ts`            | Default export, plugin entry                           |
| `executeTool`            | fn             | `src/tools.ts`            | Tool mode dispatcher (search, profile, list, help)     |
| `handleSessionIdle`      | fn             | `src/sync.ts`             | Incremental conversation sync on idle                  |
| `handleSessionCompacted` | fn             | `src/sync.ts`             | Full re-sync on session compaction                     |
| `sessionSyncState`       | Map            | `src/sync.ts`             | Incremental sync tracking per session                  |
| `subagentSessions`       | Set            | `src/state.ts`            | Tracks subagent session IDs (skip sync)                |
| `solomemoryClient`       | singleton      | `src/services/client.ts`  | All API communication                                  |
| `CONFIG`                 | Proxy          | `src/config.ts`           | Lazy-init config, accessed everywhere                  |
| `getTags`                | async fn       | `src/services/tags.ts`    | Container tag generation (project, repo, branch, etc.) |
| `formatContextForPrompt` | fn             | `src/services/context.ts` | Memory → system prompt injection                       |
| `injectedSessions`       | Set            | `src/index.ts`            | Prevents double-injection per session                  |

## HOOKS

| Hook                      | Trigger                        | Action                                                                                                                            |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `chat.message`            | First user message per session | Parallel fetch profile + user memories + project memories → inject as synthetic Part                                              |
| `event:session.idle`      | Session idle                   | Incremental sync: extract new messages since `lastSyncedMessageIndex`, build metadata, call `ingest` with sourceType=conversation |
| `event:session.compacted` | Session compacted              | Full re-sync: re-extract all messages, ingest with compacted flag                                                                 |
| `event:session.deleted`   | Session deleted                | Clean up `sessionSyncState` + `injectedSessions` Maps                                                                             |

## TOOL

`solomemory` tool with modes: `search` (query memories), `profile` (show user profile), `list` (list memories by scope), `help` (usage info).

## MEMORY SCOPING

| Scope       | Tag Source                                                                 | Example             |
| ----------- | -------------------------------------------------------------------------- | ------------------- |
| User        | `user` (hardcoded)                                                         | Cross-project prefs |
| Project     | Workspace dir hash (sha256, full 64 chars)                                 | `proj_<sha256>`     |
| Repo        | Git remote URL hash (sha256, full 64 chars)                                | `repo_<sha256>`     |
| Branch      | Git branch name (sanitized, NOT hashed)                                    | `branch_feat_auth`  |
| Language    | `linguist-js` detection + heuristic fallback                               | `lang_typescript`   |
| Framework   | `@vercel/fs-detectors` (68 fw) + Django/Laravel fb                         | `fw_nextjs`         |
| Org         | Git remote owner (lowercase)                                               | `org_mycompany`     |
| Package Mgr | Two-tier: 41 lockfiles + 8 manifest fallbacks (48 entries, 30+ ecosystems) | `pkgmgr_bun`        |
| OS          | `os.platform()`                                                            | `os_linux`          |
| Machine     | Hostname hash (sha256, full 64 chars)                                      | `machine_<sha256>`  |
| Workspace   | Monorepo workspace name (sanitized)                                        | `workspace_api`     |
| Platform    | Config `platformIdentifier`                                                | `plat_opencode`     |

## CONFIG RESOLUTION ORDER

`SOLOMEMORY_*` env vars > `~/.config/opencode/solomemory.jsonc` > `~/.config/opencode/credentials.json` > defaults

Key defaults: `similarityThreshold=0.6`, `maxMemories=5`, `maxProjectMemories=10`, `maxProfileItems=5`

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
- **Never sync subagent sessions** — tracked via `subagentSessions` Set in `state.ts`

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
