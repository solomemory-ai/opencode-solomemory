# PLUGIN SERVICES

## OVERVIEW

10 service modules + 1 types module. Client is the core. All services are stateless functions or singleton classes.

## FILES

| File                               | LOC | Purpose                                                                                                                                                                                                         |
| ---------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`                        | 7   | Facade re-export — preserves `./services/client.js` import path, delegates to `client/`                                                                                                                         |
| `client/index.ts`                  | 105 | `SolomemoryClient` class assembly + singleton. Delegates to method modules                                                                                                                                      |
| `client/api-transport.http.ts`     | 58  | HTTP plumbing: `withTimeout`, `apiRequest`, `post`, `get`, constants (`TIMEOUT_MS`, `DEFAULT_PAGE_SIZE`)                                                                                                        |
| `client/memory-search.methods.ts`  | 113 | Search operations: `searchMemories`, `searchUserMemories`, `searchGlobal`, `searchByMetadata`, `buildSearchBody`                                                                                                |
| `client/memory-crud.methods.ts`    | 131 | CRUD operations: `addMemory`, `ingest`, `deleteMemory`, `listMemories`, `listUserMemories`, `listGlobalMemories`                                                                                                |
| `client/metadata-query.methods.ts` | 88  | Metadata queries: `getProfile`, `getJobStatus`, `listProjects`, `getTopics`                                                                                                                                     |
| `client-types.ts`                  | 42  | Barrel re-export facade — preserves import path for all consumers                                                                                                                                               |
| `client-api.types.ts`              | 131 | API response shapes, request option types, discriminated union result types (pure compile-time, no runtime)                                                                                                     |
| `client-api.typeguards.ts`         | 105 | Runtime type guards (`isSearchResponse`, etc.) + failure factory utilities (`searchFailure`, etc.)                                                                                                              |
| `git.ts`                           | 80  | Git helpers: `execGitCommand`, remote origin normalization, branch/root/author/status, repo owner/name parsing                                                                                                  |
| `detectors.ts`                     | 210 | Detection engines: `detectLanguage` (linguist-js + heuristic fallback), `detectFramework` (@vercel/fs-detectors + Django/Laravel fallback), `detectPackageManager` (41 lockfiles + 8 manifests, 30+ ecosystems) |
| `tags.ts`                          | 220 | Environment helpers, 12 tag generators (repo/proj/branch/machine/workspace/lang/org/pkgmgr/os/fw/plat/session), Tags/TagMetadata interfaces, `getTags`/`getTagMetadata`/`getConversationTags`                   |
| `workspace.ts`                     | 157 | `WorkspaceInfo` detection: walks up directories for package.json/Cargo.toml/go.mod, identifies workspace type (npm/pnpm/bun/yarn/cargo/go)                                                                      |
| `context.ts`                       | 113 | Memory injection formatting: profile → system prompt, search results → context blocks with similarity% and timeAgo                                                                                              |
| `messages.ts`                      | 71  | Session message extraction, role mapping, synthetic message filtering, `lastSyncedMessageIndex` tracking                                                                                                        |
| `jsonc.ts`                         | 86  | JSONC parser state machine: strips `//` and `/* */` comments, handles escaped quotes, trailing commas                                                                                                           |
| `privacy.ts`                       | 13  | `<private>` tag detection (`containsPrivateTag`), content redaction (`stripPrivateContent`), fully-private check                                                                                                |
| `auth.ts`                          | 41  | Token resolution: `loadCredentials`/`saveCredentials`/`clearCredentials` at `~/.solomemory-opencode/credentials.json` (0o700 dir, 0o600 file)                                                                   |
| `logger.ts`                        | 51  | Async batched file logger to `~/.opencode-solomemory.log`. Queue + `setImmediate` flush. Session header on first write                                                                                          |
| `error-reporter.ts`                | 113 | Fire-and-forget error reporting to server. Sends structured errors to `POST /errors` (server forwards to Sentry). DSN never leaves server                                                                       |

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
| `addMemory()`          | POST /ingest (via `ingest()`) | `{sourceType: "memory", content: {text}, containerTags}`                                |
| `deleteMemory()`       | DELETE /memories/:id          | —                                                                                       |
| `ingest()`             | POST /ingest                  | `{sourceId, sourceType?, content, containerTags, metadata?}`                            |
| `getJobStatus()`       | GET /conversations/jobs/:id   | —                                                                                       |
| `reportError()`        | POST /errors                  | `{message, level, exceptionType, stack, pluginVersion, runtime, platform, tags, extra}` |

## DEPENDENCY FLOW

```
index.ts → client.ts (facade) → client/index.ts → client/*.methods.ts → client/api-transport.http.ts → auth.ts (token)
         → tags.ts (container tags) → config.ts
         │                          → git.ts (git helpers)
         │                          → detectors.ts (language/framework/pkgmgr)
         → messages.ts (extract messages)
         → privacy.ts (redact before sync)
         → context.ts (format injection) → config.ts (limits)
```

## CONVENTIONS

- All API calls return `{ success: true, ... } | { success: false, error }` — never throw
- Type guard per response type: `isSearchResponse`, `isProfileResponse`, etc.
- Tags include: repo, project, branch, workspace, machine, platform, language, org, package manager, OS, framework (all async)
- Message sync is incremental: `lastSyncedMessageIndex` per session
- Git operations are synchronous (`execSync`) with try/catch fallbacks to empty string
- Workspace detection walks up directories looking for JS/Cargo/Go workspace markers
