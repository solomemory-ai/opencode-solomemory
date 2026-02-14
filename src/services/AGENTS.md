# PLUGIN SERVICES

## OVERVIEW

Service modules + client subsystem. Client is the core. All services are stateless functions or singleton classes.

## FILES

| File                               | LOC | Purpose                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`                        | 7   | Facade re-export — preserves `./services/client.js` import path, delegates to `client/`                                                                                                                                                                                                                       |
| `client/index.ts`                  | 74  | `SolomemoryClient` class assembly + singleton. Delegates to method modules                                                                                                                                                                                                                                    |
| `client/api-transport.http.ts`     | 102 | HTTP plumbing: `withTimeout`, `apiRequest`, `post`, `postWithRetry`, `get`, `HttpError`, constants (`TIMEOUT_MS`, `DEFAULT_PAGE_SIZE`, `MAX_RETRIES`, `RETRY_BASE_MS`)                                                                                                                                        |
| `client/memory-search.methods.ts`  | 93  | Search operations: `searchMemories`, `searchUserMemories`, `searchGlobal`, `buildSearchBody`                                                                                                                                                                                                                  |
| `client/memory-crud.methods.ts`    | 98  | CRUD operations: `ingest`, `listMemories`, `listUserMemories`, `listGlobalMemories`                                                                                                                                                                                                                           |
| `client/metadata-query.methods.ts` | 71  | Metadata queries: `getProfile`, `listProjects`, `getTopics`                                                                                                                                                                                                                                                   |
| `client-types.ts`                  | 40  | Barrel re-export facade — preserves import path for all consumers                                                                                                                                                                                                                                             |
| `client-api.types.ts`              | 130 | API response shapes, request option types, discriminated union result types (pure compile-time, no runtime)                                                                                                                                                                                                   |
| `client-api.typeguards.ts`         | 104 | Runtime type guards (`isSearchResponse`, etc.) + failure factory utilities (`searchFailure`, etc.)                                                                                                                                                                                                            |
| `git.ts`                           | 80  | Git helpers: `execGitCommand`, remote origin normalization, branch/root/author/status, repo owner/name parsing                                                                                                                                                                                                |
| `detectors.ts`                     | 223 | Detection engines: `detectLanguages` (linguist-js + heuristic fallback, returns all langs sorted by byte count), `detectLanguage` (single-value convenience wrapper), `detectFramework` (@vercel/fs-detectors + Django/Laravel fallback), `detectPackageManager` (41 lockfiles + 8 manifests, 30+ ecosystems) |
| `tags.ts`                          | 153 | Environment helpers, 12 tag generators (repo/proj/branch/machine/workspace/langs/org/pkgmgr/os/fw/plat), `Tags` interface, `getTags`. Used for ingest metadata enrichment only (not query filtering). Language tags are multi-value (`languages: string[]`, emits multiple `lang_*` container tags)           |
| `workspace.ts`                     | 157 | `WorkspaceInfo` detection: walks up directories for package.json/Cargo.toml/go.mod, identifies workspace type (npm/pnpm/bun/yarn/cargo/go)                                                                                                                                                                    |
| `context.ts`                       | 166 | Memory injection formatting: profile + user memories + project topics → system prompt. Includes `formatTopicSection`, similarity%, timeAgo, and CTA for solomemory tool                                                                                                                                       |
| `messages.ts`                      | 91  | `MessageInfo`/`SessionMessage` types, `extractContentFromParts()` (text-only), `extractReasoningText()` (reasoning), `extractToolEntries()` (completed ToolParts → compact tool entries with title fallback + path relativization)                                                                            |
| `jsonc.ts`                         | 145 | JSONC parser state machine: strips `//` and `/* */` comments, handles escaped quotes, trailing commas                                                                                                                                                                                                         |
| `auth.ts`                          | 53  | Token resolution: `loadCredentials`/`saveCredentials`/`clearCredentials`/`getCredentialsDir` at `~/.solomemory-opencode/credentials.json` (0o700 dir, 0o600 file)                                                                                                                                             |
| `logger.ts`                        | 55  | Async batched file logger to `~/.opencode-solomemory.log`. Queue + `setImmediate` flush. Session header on first write                                                                                                                                                                                        |
| `error-reporter.ts`                | 145 | Fire-and-forget error reporting to server. Sends structured errors to `POST /errors` (server forwards to Sentry). DSN never leaves server                                                                                                                                                                     |
| `payload-dump.ts`                  | 68  | Ingest payload dumper: writes each `IngestPayload` as timestamped JSON file to configurable dir. Fire-and-forget, gated by `CONFIG.dumpIngestPayloads`. Default dir `~/.solomemory-dumps/`                                                                                                                    |

## API ENDPOINTS (client.ts)

| Method                 | Endpoint             | Body / Params                                                                                           |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| `searchMemories()`     | POST /search         | `{q, metadataFilters: [{field:<scope.field>, operator:"eq", value:<scope.value>}], limit?, threshold?}` |
| `searchUserMemories()` | POST /search/user    | `{q, limit?, threshold?}`                                                                               |
| `searchGlobal()`       | POST /search         | `{q, limit?, threshold?}`                                                                               |
| `getProfile()`         | GET /profile         | `?q=` (optional query param)                                                                            |
| `listMemories()`       | POST /memories/list  | `{metadataFilters: [{field:<scope.field>, operator:"eq", value:<scope.value>}], limit}`                 |
| `listUserMemories()`   | POST /memories/user  | `{limit}`                                                                                               |
| `listGlobalMemories()` | POST /memories/list  | `{limit}` (no filter — global scope)                                                                    |
| `ingest()`             | POST /ingest         | `{sourceId, sourceType?, content, metadata: {platform, branch, repository, ...}}`                       |
| `listProjects()`       | GET /projects        | —                                                                                                       |
| `getTopics()`          | GET /memories/topics | `?metadataFilters=[{field:<scope.field>, operator:"eq", value:<scope.value>}]` (JSON-encoded)           |
| `reportError()`        | POST /errors         | `{message, level, exceptionType, stack, pluginVersion, runtime, platform, tags, extra}`                 |

## DEPENDENCY FLOW

```
index.ts → sync.ts (facade) → sync/session-event.handlers.ts → sync/conversation-ingest.service.ts → client/ (ingest)
         │                                                     → payload-dump.ts (optional, config-gated)
         │                  → sync/conversation-metadata.mapper.ts → config.ts
         │                                                        → git.ts (branch, repo, author, status, owner, name)
         │                                                        → detectors.ts (languages, framework, packageManager)
         │                                                        → workspace.ts (workspace name, type, isMonorepo)
         │                                                        → tags.ts (getMachineId, getOS, getNodeVersion, etc.)
         │                  → sync/session-message.validation.ts → messages.ts
         → context.ts (format injection) → config.ts (limits)
         → client.ts (facade) → client/index.ts → client/*.methods.ts → client/api-transport.http.ts → auth.ts (token)
         → client/ → metadata-query.methods.ts → getTopics (used by context injection in index.ts)
```

## CONVENTIONS

- All API calls return `{ success: true, ... } | { success: false, error }` — never throw
- Type guard per response type: `isSearchResponse`, `isProfileResponse`, etc.
- Both ingest (write) and query (read) use named metadata fields — no `tags` array in payloads. Server derives routing tags from named fields. Query methods filter by `ProjectScope` (`{ field: "repository" | "directory", value: "<raw value>" }`)
- Tag generators in `tags.ts`: repo, project, branch, workspace, machine, platform, languages (multi-value), org, package manager, OS, framework (all async). Used for ingest metadata enrichment only
- Message sync is incremental: `lastSyncedMessageIndex` per session
- Git operations are synchronous (`execSync`) with try/catch fallbacks to empty string
- Workspace detection walks up directories looking for JS/Cargo/Go workspace markers
- HTTP transport includes retry logic (`postWithRetry`) with exponential backoff for ingest calls
