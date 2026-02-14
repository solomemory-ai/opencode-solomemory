# OPENCODE-SOLOMEMORY PLUGIN

**Generated:** 2026-02-14

## OVERVIEW

OpenCode AI plugin. Syncs conversations to solomemory-api, injects user profile + relevant memories + project topics into context. Bun runtime, TypeScript strict.

## STRUCTURE

```
opencode-solomemory/
├── src/
│   ├── index.ts           # Entry: hooks registration, context injection, session mgmt
│   ├── tools.ts           # Tool handler: solomemory tool modes (search, profile, list, projects, help)
│   ├── sync.ts            # Facade re-export — delegates to sync/ submodules
│   ├── sync/
│   │   ├── session-event.handlers.ts     # session.idle + session.compacted handlers
│   │   ├── conversation-ingest.service.ts # Build IngestPayload, optional dump, call API
│   │   ├── conversation-metadata.mapper.ts # Extract metadata from session/tags
│   │   ├── session-message.validation.ts  # Message validation + filtering
│   │   ├── sync-state.store.ts            # sessionSyncState Map
│   │   └── sync.types.ts                  # ConversationSyncState, SessionIdleInput
│   ├── state.ts           # Shared state: subagentSessions Set
│   ├── config.ts          # Config resolution via Proxy (env > jsonc > credentials > defaults)
│   ├── cli.ts             # CLI entry (delegates to cli/)
│   ├── cli/
│   │   ├── index.ts       # CLI command router (install, help)
│   │   ├── install.ts     # Install command: config patching, slash commands, API key save
│   │   └── templates.ts   # /solomemory-init and /solomemory-login slash command templates
│   ├── types/
│   │   └── index.ts       # Shared interfaces: Result<T,E>, Memory, ConversationMessage
│   └── services/          # Service modules (see services/AGENTS.md)
├── docs/
│   ├── CONFIG.md          # Full config reference
│   ├── CONTRIBUTING.md    # Contributing guide
│   └── RELEASE.md         # Release process
├── scripts/
│   └── release.sh         # Version bump + publish (patch|minor|major)
└── .github/workflows/
    └── publish.yml        # Dual-track: dev builds on v1.0 push, releases on v* tags
```

## WHERE TO LOOK

| Task                  | Location                                  | Notes                                             |
| --------------------- | ----------------------------------------- | ------------------------------------------------- |
| Add hook              | `src/index.ts`                            | Register in plugin hooks object + opencode config |
| Add tool mode         | `src/tools.ts`                            | Switch case in `executeTool()` handler            |
| Modify sync behavior  | `src/sync/session-event.handlers.ts`      | `handleSessionIdle()`, `handleSessionCompacted()` |
| Modify ingest payload | `src/sync/conversation-ingest.service.ts` | Builds payload, optional dump, calls API          |
| Payload dump feature  | `src/services/payload-dump.ts`            | Fire-and-forget JSON dump, gated by config        |
| Add API endpoint      | `src/services/client.ts`                  | New method + type in `client-types.ts`            |
| Change context format | `src/services/context.ts`                 | `formatContextForPrompt()`                        |
| Add tag type          | `src/services/tags.ts`                    | New async getter + add to `getTags()` return      |
| Change config option  | `src/config.ts` + `src/types/index.ts`    | Add to RuntimeConfig, update defaults             |
| Add CLI command       | `src/cli/index.ts`                        | New case in command router                        |
| Workspace detection   | `src/services/workspace.ts`               | Walk-up directory search for project markers      |

## CODE MAP

| Symbol                      | Type           | Location                                   | Role                                                                                                      |
| --------------------------- | -------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `SolomemoryPlugin`          | const (Plugin) | `src/index.ts`                             | Default export, plugin entry                                                                              |
| `executeTool`               | fn             | `src/tools.ts`                             | Tool mode dispatcher (search, profile, list, projects, help)                                              |
| `handleSessionIdle`         | fn             | `src/sync/session-event.handlers.ts`       | Incremental sync on idle: uses compaction anchor if set, filters synthetic msgs                           |
| `handleSessionCompacted`    | fn             | `src/sync/session-event.handlers.ts`       | Sets compaction anchor on sync state (defers ingest to next idle)                                         |
| `sessionSyncState`          | Map            | `src/sync/sync-state.store.ts`             | Incremental sync tracking per session                                                                     |
| `fetchSessionMessages`      | fn             | `src/sync/conversation-ingest.service.ts`  | Fetch session messages + init sync state on reload                                                        |
| `handleNoMessages`          | fn             | `src/sync/conversation-ingest.service.ts`  | Update sync state when no valid messages to sync                                                          |
| `ingestAndLogResult`        | fn             | `src/sync/conversation-ingest.service.ts`  | Build payload, optional dump, call API, log result                                                        |
| `buildConversationMetadata` | fn             | `src/sync/conversation-metadata.mapper.ts` | Extract metadata object from session info + tags                                                          |
| `extractValidMessages`      | fn             | `src/sync/session-message.validation.ts`   | Incremental extraction from anchor, filters summaries + synthetic, emits thinking + tool entries          |
| `findLastUserMessageIndex`  | fn             | `src/sync/session-message.validation.ts`   | Scans backward for last user message; used to initialize sync state on session reload                     |
| `extractContentFromParts`   | fn             | `src/services/messages.ts`                 | Extracts text content from message parts (text-only, excludes reasoning)                                  |
| `extractReasoningText`      | fn             | `src/services/messages.ts`                 | Extracts reasoning/thinking text from `ReasoningPart` entries (separate from text content)                |
| `extractToolEntries`        | fn             | `src/services/messages.ts`                 | Extracts compact tool entries from completed `ToolPart`s — `{ role: "tool", content: "<tool>: <title>" }` |
| `initSyncState`             | fn             | `src/sync/sync-state.store.ts`             | Creates sync state for session; accepts optional `initialIndex` for session reload                        |
| `dumpIngestPayload`         | fn             | `src/services/payload-dump.ts`             | Write payload JSON to disk (fire-and-forget)                                                              |
| `subagentSessions`          | Set            | `src/state.ts`                             | Tracks subagent session IDs (skip sync)                                                                   |
| `solomemoryClient`          | singleton      | `src/services/client.ts`                   | All API communication                                                                                     |
| `CONFIG`                    | Proxy          | `src/config.ts`                            | Lazy-init config, accessed everywhere                                                                     |
| `getTags`                   | async fn       | `src/services/tags.ts`                     | Container tag generation (project, repo, branch, etc.)                                                    |
| `getTagMetadata`            | async fn       | `src/services/tags.ts`                     | Full metadata for ingest (tags + raw values)                                                              |
| `getConversationTags`       | async fn       | `src/services/tags.ts`                     | Subset of tags for conversation context                                                                   |
| `formatContextForPrompt`    | fn             | `src/services/context.ts`                  | Profile + user memories + project topics → system prompt injection                                        |
| `injectedSessions`          | Set            | `src/index.ts`                             | Prevents double-injection per session                                                                     |
| `loadSubagentNames`         | async fn       | `src/index.ts`                             | Fetches agent list from OpenCode SDK for subagent detection                                               |
| `isSubagentAgent`           | fn             | `src/index.ts`                             | Checks if session belongs to a subagent by name                                                           |

## HOOKS

| Hook                      | Trigger                        | Action                                                                                                    |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `chat.message`            | First user message per session | Parallel fetch profile + user memories + project topics → inject as synthetic Part with CTA               |
| `event:session.idle`      | Session idle                   | Incremental sync: extract from compaction anchor (or lastSynced), filter synthetic + summary msgs, ingest |
| `event:session.compacted` | Session compacted              | Set compaction anchor on sync state to freeze extraction start point; defer ingest to next idle event     |
| `event:session.deleted`   | Session deleted                | Clean up `sessionSyncState` + `injectedSessions` + `subagentSessions`                                     |

## TOOL

`solomemory` tool with modes: `search` (query memories), `profile` (show user profile), `list` (list memories by scope), `projects` (list known projects), `help` (usage info).

Tool arguments: `mode` (required), `query` (for search), `scope` (user/project/global), `limit`, `path` (cross-project search), `containerTag` (target project by tag — resolved to `metadataFilters` before API call).

## MEMORY SCOPING

| Scope       | Tag Source                                                                 | Example                          |
| ----------- | -------------------------------------------------------------------------- | -------------------------------- |
| User        | `user` (hardcoded)                                                         | Cross-project prefs              |
| Project     | Workspace dir hash (sha256, full 64 chars)                                 | `proj_<sha256>`                  |
| Repo        | Git remote URL hash (sha256, full 64 chars)                                | `repo_<sha256>`                  |
| Branch      | Git branch name (sanitized, NOT hashed)                                    | `branch_feat_auth`               |
| Language    | `linguist-js` detection + heuristic fallback (multi-tag, all detected)     | `lang_python`, `lang_typescript` |
| Framework   | `@vercel/fs-detectors` (68 fw) + Django/Laravel fb                         | `fw_nextjs`                      |
| Org         | Git remote owner (lowercase)                                               | `org_mycompany`                  |
| Package Mgr | Two-tier: 41 lockfiles + 8 manifest fallbacks (48 entries, 30+ ecosystems) | `pkgmgr_bun`                     |
| OS          | `os.platform()`                                                            | `os_linux`                       |
| Machine     | Hostname hash (sha256, full 64 chars)                                      | `machine_<sha256>`               |
| Workspace   | Monorepo workspace name (sanitized)                                        | `workspace_api`                  |
| Platform    | Config `platformIdentifier`                                                | `plat_opencode`                  |

## CONFIG RESOLUTION ORDER

`SOLOMEMORY_*` env vars > `~/.config/opencode/solomemory.jsonc` > `~/.config/opencode/credentials.json` > defaults

Key defaults: `maxMemories=5`, `maxProjectMemories=10`, `maxProfileItems=5`, `injectProfile=true`, `platformIdentifier="opencode"`, `autoSyncConversations=true`, `dumpIngestPayloads=false`, `dumpDir=""` (falls back to `~/.solomemory-dumps/`)

## CONVENTIONS

- TypeScript strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`
- Bun runtime (not Node), ESNext target, bundler module resolution
- ESLint strict: max-lines:300, max-lines-per-function:50, max-params:3, max-statements:15, complexity:10, max-depth:3
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
- CLI has only `install` and `help` commands (no login/logout/status)
- CLI install command modifies opencode config AND creates slash commands (`/solomemory-init`, `/solomemory-login`)
- Release: `scripts/release.sh {patch|minor|major}` → git tag → GitHub Actions publishes to npm
- CI dual-track: dev builds on push to `v1.0` branch, releases on `v*` tags
- JSONC parser is hand-rolled state machine (handles comments, trailing commas, escaped quotes)
- Context injection includes CTA telling the agent about the `solomemory` tool
- **Thinking blocks**: Assistant reasoning parts (`type: "reasoning"`) are extracted as separate `{ role: "thinking" }` message entries, distinct from text content. `extractContentFromParts` handles text-only, `extractReasoningText` handles reasoning-only
- **Session reload**: When plugin starts on an existing session (in-memory state lost), `findLastUserMessageIndex` scans backward to find the last user message and initializes sync state from there — prevents replaying entire session history
- **Compaction deferral**: `session.compacted` sets a `compactionAnchorIndex` on sync state instead of ingesting; the next `session.idle` uses the anchor as extraction start point
- **Synthetic message filtering**: OpenCode injects `"Continue if you have next steps..."` user messages during auto-compaction — these are filtered out by `isSyntheticUserMessage` in `extractValidMessages`
- **Message output format**: Each ingest contains `{ role: "user" | "assistant" | "thinking" | "tool", content: string }[]` — thinking entries precede assistant text, tool entries follow (format: `"<tool>: <title>"`)
- **Tool entries**: Completed `ToolPart`s from OpenCode SDK are extracted as `{ role: "tool" }` entries. Only `status: "completed"` tools are included. Uses SDK-native `part.tool` (name) and `part.state.title` (description) — no parsing
- **Multi-language detection**: `detectLanguages()` returns all programming languages sorted by byte count (via linguist-js). `Tags.languages` is `string[]`, emitting multiple `lang_*` container tags. Ingest metadata includes `languages` (comma-separated list of all detected)
