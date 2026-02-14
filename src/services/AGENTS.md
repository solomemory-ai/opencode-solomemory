# PLUGIN SERVICES

## OVERVIEW

Service modules + client subsystem. Client is the core. All services are stateless functions or singleton classes.

## FILES

| File                               | LOC | Purpose                                                                                                                                                                                                         |
| ---------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`                        | 8   | Facade re-export — preserves `./services/client.js` import path, delegates to `client/`                                                                                                                         |
| `client/index.ts`                  | 106 | `SolomemoryClient` class assembly + singleton. Delegates to method modules                                                                                                                                      |
| `client/api-transport.http.ts`     | 103 | HTTP plumbing: `withTimeout`, `apiRequest`, `post`, `postWithRetry`, `get`, `HttpError`, constants (`TIMEOUT_MS`, `DEFAULT_PAGE_SIZE`, `MAX_RETRIES`, `RETRY_BASE_MS`)                                          |
| `client/memory-search.methods.ts`  | 113 | Search operations: `searchMemories`, `searchUserMemories`, `searchGlobal`, `searchByMetadata`, `buildSearchBody`                                                                                                |
| `client/memory-crud.methods.ts`    | 142 | CRUD operations: `addMemory`, `ingest`, `deleteMemory`, `listMemories`, `listUserMemories`, `listGlobalMemories`                                                                                                |
| `client/metadata-query.methods.ts` | 88  | Metadata queries: `getProfile`, `getJobStatus`, `listProjects`, `getTopics`                                                                                                                                     |
| `client-types.ts`                  | 41  | Barrel re-export facade — preserves import path for all consumers                                                                                                                                               |
| `client-api.types.ts`              | 131 | API response shapes, request option types, discriminated union result types (pure compile-time, no runtime)                                                                                                     |
| `client-api.typeguards.ts`         | 105 | Runtime type guards (`isSearchResponse`, etc.) + failure factory utilities (`searchFailure`, etc.)                                                                                                              |
| `git.ts`                           | 81  | Git helpers: `execGitCommand`, remote origin normalization, branch/root/author/status, repo owner/name parsing                                                                                                  |
| `detectors.ts`                     | 216 | Detection engines: `detectLanguage` (linguist-js + heuristic fallback), `detectFramework` (@vercel/fs-detectors + Django/Laravel fallback), `detectPackageManager` (41 lockfiles + 8 manifests, 30+ ecosystems) |
| `tags.ts`                          | 219 | Environment helpers, 12 tag generators (repo/proj/branch/machine/workspace/lang/org/pkgmgr/os/fw/plat/session), Tags/TagMetadata interfaces, `getTags`/`getTagMetadata`/`getConversationTags`                   |
| `workspace.ts`                     | 158 | `WorkspaceInfo` detection: walks up directories for package.json/Cargo.toml/go.mod, identifies workspace type (npm/pnpm/bun/yarn/cargo/go)                                                                      |
| `context.ts`                       | 167 | Memory injection formatting: profile + user memories + project topics → system prompt. Includes `formatTopicSection`, similarity%, timeAgo, and CTA for solomemory tool                                         |
| `messages.ts`                      | 33  | `MessageInfo` type, `SessionMessage` type, `extractContentFromParts()` — content extraction from message parts                                                                                                  |
| `jsonc.ts`                         | 146 | JSONC parser state machine: strips `//` and `/* */` comments, handles escaped quotes, trailing commas                                                                                                           |
| `auth.ts`                          | 54  | Token resolution: `loadCredentials`/`saveCredentials`/`clearCredentials`/`getCredentialsDir` at `~/.solomemory-opencode/credentials.json` (0o700 dir, 0o600 file)                                               |
| `logger.ts`                        | 56  | Async batched file logger to `~/.opencode-solomemory.log`. Queue + `setImmediate` flush. Session header on first write                                                                                          |
| `error-reporter.ts`                | 146 | Fire-and-forget error reporting to server. Sends structured errors to `POST /errors` (server forwards to Sentry). DSN never leaves server                                                                       |
| `payload-dump.ts`                  | 69  | Ingest payload dumper: writes each `IngestPayload` as timestamped JSON file to configurable dir. Fire-and-forget, gated by `CONFIG.dumpIngestPayloads`. Default dir `~/.solomemory-dumps/`                      |

## API ENDPOINTS (client.ts)

| Method                 | Endpoint                      | Body                                                                                    |
| ---------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `searchMemories()`     | POST /search                  | `{q, containerTag, limit?, threshold?}`                                                 |
| `searchUserMemories()` | POST /search/user             | `{q, limit?, threshold?}`                                                               |
| `searchGlobal()`       | POST /search                  | `{q, limit?, threshold?}`                                                               |
| `searchByMetadata()`   | POST /search                  | `{q, containerTags, filters, limit?}`                                                   |
| `getProfile()`         | GET /profile                  | `?q=` (optional query param)                                                            |
| `listMemories()`       | POST /memories/list           | `{containerTag, limit}`                                                                 |
| `listUserMemories()`   | POST /memories/user           | `{limit}`                                                                               |
| `listGlobalMemories()` | POST /memories/list           | `{limit}` (no containerTag — global scope)                                              |
| `addMemory()`          | POST /ingest (via `ingest()`) | `{sourceType: "memory", content: {text}, containerTags}`                                |
| `deleteMemory()`       | DELETE /memories/:id          | — (via `apiRequest`, not `post`)                                                        |
| `ingest()`             | POST /ingest                  | `{sourceId, sourceType?, content, containerTags, metadata?}`                            |
| `getJobStatus()`       | GET /conversations/jobs/:id   | —                                                                                       |
| `listProjects()`       | GET /projects                 | —                                                                                       |
| `getTopics()`          | GET /memories/topics          | `?containerTag=` (optional query param)                                                 |
| `reportError()`        | POST /errors                  | `{message, level, exceptionType, stack, pluginVersion, runtime, platform, tags, extra}` |

## DEPENDENCY FLOW

```
index.ts → sync.ts (facade) → sync/session-event.handlers.ts → sync/conversation-ingest.service.ts → client/ (ingest)
         │                                                     → payload-dump.ts (optional, config-gated)
         │                  → sync/conversation-metadata.mapper.ts → tags.ts → config.ts
         │                                                                   → git.ts
         │                                                                   → detectors.ts
         │                  → sync/session-message.validation.ts → messages.ts
         → context.ts (format injection) → config.ts (limits)
         → client.ts (facade) → client/index.ts → client/*.methods.ts → client/api-transport.http.ts → auth.ts (token)
         → client/ → metadata-query.methods.ts → getTopics (used by context injection in index.ts)
```

## CONVENTIONS

- All API calls return `{ success: true, ... } | { success: false, error }` — never throw
- Type guard per response type: `isSearchResponse`, `isProfileResponse`, etc.
- Tags include: repo, project, branch, workspace, machine, platform, language, org, package manager, OS, framework (all async)
- Message sync is incremental: `lastSyncedMessageIndex` per session
- Git operations are synchronous (`execSync`) with try/catch fallbacks to empty string
- Workspace detection walks up directories looking for JS/Cargo/Go workspace markers
- HTTP transport includes retry logic (`postWithRetry`) with exponential backoff for ingest calls
