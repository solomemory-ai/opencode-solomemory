# PLUGIN SERVICES

## OVERVIEW

10 service modules + 1 types module. Client is the core. All services are stateless functions or singleton classes.

## FILES

| File                | LOC | Purpose                                                                                                                                                                       |
| ------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`         | 300 | `SolomemoryClient` singleton. HTTP client (30s timeout), all API calls, discriminated union results                                                                           |
| `client-types.ts`   | 201 | API response types, type guards (`isSearchResponse`, `isProfileResponse`, etc.), shared interfaces                                                                            |
| `tags.ts`           | 324 | Git remote/branch/author extraction (execSync), URL normalization, workspace hashing (sha256→16 chars), monorepo/language/package-manager detection, container tag generation |
| `workspace.ts`      | 157 | `WorkspaceInfo` detection: walks up directories for package.json/Cargo.toml/go.mod, identifies workspace type (npm/pnpm/bun/yarn/cargo/go)                                    |
| `context.ts`        | 113 | Memory injection formatting: profile → system prompt, search results → context blocks with similarity% and timeAgo                                                            |
| `messages.ts`       | 71  | Session message extraction, role mapping, synthetic message filtering, `lastSyncedMessageIndex` tracking                                                                      |
| `jsonc.ts`          | 86  | JSONC parser state machine: strips `//` and `/* */` comments, handles escaped quotes, trailing commas                                                                         |
| `privacy.ts`        | 13  | `<private>` tag detection (`containsPrivateTag`), content redaction (`stripPrivateContent`), fully-private check                                                              |
| `auth.ts`           | 41  | Token resolution: `loadCredentials`/`saveCredentials`/`clearCredentials` at `~/.solomemory-opencode/credentials.json` (0o700 dir, 0o600 file)                                 |
| `logger.ts`         | 51  | Async batched file logger to `~/.opencode-solomemory.log`. Queue + `setImmediate` flush. Session header on first write                                                        |
| `error-reporter.ts` | 113 | Fire-and-forget error reporting to server. Sends structured errors to `POST /errors` (server forwards to Sentry). DSN never leaves server                                     |

## API ENDPOINTS (client.ts)

| Method                 | Endpoint                    | Body                                                                                    |
| ---------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `searchMemories()`     | POST /search                | `{q, containerTag, limit?, threshold?}`                                                 |
| `searchUserMemories()` | POST /search/user           | `{q, limit?, threshold?}`                                                               |
| `searchGlobal()`       | POST /search                | `{q, limit?, threshold?}`                                                               |
| `searchByMetadata()`   | POST /search                | `{q, containerTags, filters, limit?}`                                                   |
| `getProfile()`         | GET /profile                | `?q=` (optional query param)                                                            |
| `listMemories()`       | POST /memories/list         | `{containerTag, limit}`                                                                 |
| `listUserMemories()`   | POST /memories/user         | `{limit}`                                                                               |
| `addMemory()`          | POST /memories              | `{content, containerTag, metadata?}`                                                    |
| `deleteMemory()`       | DELETE /memories/:id        | —                                                                                       |
| `ingestConversation()` | POST /conversations         | `{conversationId, messages, containerTags, metadata}`                                   |
| `getJobStatus()`       | GET /conversations/jobs/:id | —                                                                                       |
| `reportError()`        | POST /errors                | `{message, level, exceptionType, stack, pluginVersion, runtime, platform, tags, extra}` |

## DEPENDENCY FLOW

```
index.ts → client.ts → auth.ts (token)
         → tags.ts (container tags) → config.ts (prefix)
         → messages.ts (extract messages)
         → privacy.ts (redact before sync)
         → context.ts (format injection) → config.ts (limits)
```

## CONVENTIONS

- All API calls return `{ success: true, ... } | { success: false, error }` — never throw
- Type guard per response type: `isSearchResponse`, `isProfileResponse`, etc.
- Tags include: git remote, branch, author, workspace hash, machine ID, platform
- Message sync is incremental: `lastSyncedMessageIndex` per session
- Git operations are synchronous (`execSync`) with try/catch fallbacks to empty string
- Workspace detection walks up directories looking for JS/Cargo/Go workspace markers
