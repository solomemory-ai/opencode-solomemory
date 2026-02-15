# OPENCODE-SOLOMEMORY PLUGIN

OpenCode AI plugin. Syncs conversations to solomemory-api, injects user profile + relevant memories + project topics into context. Bun runtime, TypeScript strict. No automated tests.

## COMMANDS

```bash
bun install                # Install dependencies
bun run build              # Bundle plugin + CLI, emit declarations
bun run typecheck          # tsc --noEmit (primary verification)
bun run check              # Full gate: eslint + prettier + typecheck + build
bun run lint               # ESLint only
bun run lint:fix           # ESLint autofix
bun run format             # Prettier write
bun run format:check       # Prettier check
bun dev                    # tsc --watch
```

No test framework exists. Verify changes with `bun run check`. There are no tests to run.

## CODE STYLE

### TypeScript Strictness

- `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`
- Every index access returns `T | undefined` -- always handle the undefined case
- Type assertions (`as`) are **banned** (`assertionStyle: "never"`) -- use type guards instead
- `no-explicit-any: error` -- use `unknown` + narrowing
- `no-unsafe-assignment/call/member-access/return: error`
- `explicit-function-return-type: error` -- all functions need explicit return types
- `strict-boolean-expressions: error` (allowString: true, allowNumber: false)
- `prefer-readonly: error` -- mark fields `readonly` when not reassigned

### Imports

- `verbatimModuleSyntax` requires explicit `type` keyword for type-only imports:
  ```typescript
  import type { Plugin } from "@opencode-ai/plugin";
  import { tool } from "@opencode-ai/plugin";
  ```
- All local imports use `.js` extension: `import { CONFIG } from "./config.js";`
- Import order enforced by `simple-import-sort`: node builtins > external > internal
- Barrel re-exports for facade modules (`sync.ts`, `services/client.ts`)

### Formatting (Prettier)

- Double quotes, semicolons, trailing commas (`"all"`)
- Print width: 100, tab width: 2
- Pre-commit hook runs `lint-staged` (ESLint on `src/**/*.ts`, Prettier on config/docs)

### Naming Conventions

| Symbol           | Convention                            | Examples                                           |
| ---------------- | ------------------------------------- | -------------------------------------------------- |
| Functions        | `camelCase`                           | `handleSessionIdle`, `extractValidMessages`        |
| Variables        | `camelCase` or `UPPER_CASE`           | `syncState`, `MAX_RETRIES`, `TIMEOUT_MS`           |
| Exported consts  | `camelCase`/`UPPER_CASE`/`PascalCase` | `solomemoryClient`, `CONFIG`, `SolomemoryPlugin`   |
| Types/Interfaces | `PascalCase` (no `I` prefix)          | `ProjectScope`, `ConversationSyncState`            |
| Files            | `kebab-case.ts`                       | `session-event.handlers.ts`, `sync-state.store.ts` |

File suffixes: `.handlers.ts`, `.service.ts`, `.methods.ts`, `.mapper.ts`, `.validation.ts`, `.store.ts`, `.types.ts`, `.typeguards.ts`

### Complexity Limits (ESLint enforced)

- `max-lines: 300`, `max-lines-per-function: 50`, `max-params: 3`
- `max-statements: 15`, `complexity: 10`, `max-depth: 3`, `max-nested-callbacks: 3`
- `no-magic-numbers` (only `-1, 0, 1, 2` inline; use named constants with `_` separators: `10_000`)

### Error Handling

Never throw from API methods. Use discriminated union results:

```typescript
type SearchResult =
  | { success: true; results: Item[]; total: number }
  | { success: false; error: string; results: []; total: 0 };
```

Use failure factory helpers (`searchFailure(msg)`), runtime type guards for API responses, and `toErrorMessage(error)` for safe error extraction. `reportError()` is always fire-and-forget. Git operations return `string | null` (null on failure).

### Anti-Patterns to Avoid

- **No `as any` / `as Type` / `@ts-ignore` / `@ts-expect-error`**
- **No auto git commits** -- user controls version history
- **Never send user identity from client** -- server derives from auth token
- **Never sync subagent sessions** -- tracked via `subagentSessions` Set
- `eslint-disable` comments only with specific rule names, used very sparingly

## ARCHITECTURE

### Structure

```
src/
  index.ts              # Plugin entry: hooks, context injection, session management
  tools.ts              # Tool handler: search, profile, list, projects, help modes
  sync.ts               # Facade re-export to sync/ submodules
  config.ts             # Config via Proxy (env > jsonc > credentials > defaults)
  state.ts              # Shared state: subagentSessions Set
  cli.ts                # CLI entry -> cli/ submodules
  types/index.ts        # Shared interfaces: Result<T,E>, Memory, ProjectScope
  sync/                 # Conversation sync pipeline
    session-event.handlers.ts, conversation-ingest.service.ts,
    conversation-metadata.mapper.ts, session-message.validation.ts,
    sync-state.store.ts, sync.types.ts
  services/             # Service layer (see services/AGENTS.md)
    client/, context.ts, tags.ts, git.ts, detectors.ts, workspace.ts,
    messages.ts, auth.ts, logger.ts, error-reporter.ts, payload-dump.ts
  cli/                  # CLI commands
    index.ts, install.ts, templates.ts
```

### Key Patterns

- **Config**: `CONFIG` proxy with lazy init; resolution: env vars > JSONC file > credentials > defaults
- **API client**: `solomemoryClient` singleton; methods use `postWithRetry` with exponential backoff
- **Hooks**: `chat.message` (context injection), `session.idle` (incremental sync), `session.compacted` (anchor), `session.deleted` (cleanup)
- **Project scoping**: `resolveProjectScope()` returns `{ field: "repository"|"directory", value }` via git remote detection
- **Ingest metadata**: Named fields (repository, branch, languages, frameworks, etc.) -- no tags array; server derives routing tags

### Where to Look

| Task                  | Location                                   |
| --------------------- | ------------------------------------------ |
| Add hook              | `src/index.ts`                             |
| Add tool mode         | `src/tools.ts`                             |
| Modify sync behavior  | `src/sync/session-event.handlers.ts`       |
| Modify ingest payload | `src/sync/conversation-ingest.service.ts`  |
| Add API endpoint      | `src/services/client/` + `client-types.ts` |
| Change context format | `src/services/context.ts`                  |
| Change config option  | `src/config.ts` + `src/types/index.ts`     |
| Add CLI command       | `src/cli/index.ts`                         |

## RUNTIME

- **Bun** (not Node) -- ESNext target, bundler module resolution
- Dual build targets: `src/index.ts` (plugin) -> `dist/index.js`, `src/cli.ts` -> `dist/cli.js`
- Git ops via `execSync` (synchronous)
- Logging: async batched file logger to `~/.opencode-solomemory.log`
- Auth: Bearer token at `~/.solomemory-opencode/credentials.json` (0o600)
- Release: `scripts/release.sh {patch|minor|major}` -> git tag -> GitHub Actions -> npm
