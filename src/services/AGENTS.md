# PLUGIN SERVICES

## OVERVIEW

8 service modules. Client is the core (457 LOC). All services are stateless functions or singleton classes.

## FILES

| File          | LOC | Purpose                                                                                                                                                                       |
| ------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`   | 457 | `SolomemoryClient` singleton. HTTP client (30s timeout), all API calls, type guards, discriminated union results                                                              |
| `tags.ts`     | 435 | Git remote/branch/author extraction (execSync), URL normalization, workspace hashing (sha256→16 chars), monorepo/language/package-manager detection, container tag generation |
| `context.ts`  | 113 | Memory injection formatting: profile → system prompt, search results → context blocks with similarity% and timeAgo                                                            |
| `messages.ts` | 71  | Session message extraction, role mapping, synthetic message filtering, `lastSyncedMessageIndex` tracking                                                                      |
| `jsonc.ts`    | 86  | JSONC parser state machine: strips `//` and `/* */` comments, handles escaped quotes, trailing commas                                                                         |
| `privacy.ts`  | 13  | `<private>` tag detection (`containsPrivateTag`), content redaction (`stripPrivateContent`), fully-private check                                                              |
| `auth.ts`     | 41  | Token resolution: `loadCredentials`/`saveCredentials`/`clearCredentials` at `~/.solomemory-opencode/credentials.json` (0o700 dir, 0o600 file)                                 |
| `logger.ts`   | 51  | Async batched file logger to `~/.opencode-solomemory.log`. Queue + `setImmediate` flush. Session header on first write                                                        |

## API ENDPOINTS (client.ts)

| Method                 | Endpoint                    | Body                                                  |
| ---------------------- | --------------------------- | ----------------------------------------------------- |
| `searchMemories()`     | POST /search                | `{q, containerTag, limit?, threshold?}`               |
| `searchUserMemories()` | POST /search/user           | `{q, limit?, threshold?}`                             |
| `searchGlobal()`       | POST /search                | `{q, limit?, threshold?}`                             |
| `searchByMetadata()`   | POST /search                | `{q, containerTags, filters, limit?}`                 |
| `getProfile()`         | GET /profile                | `?q=` (optional query param)                          |
| `listMemories()`       | POST /memories/list         | `{containerTag, limit}`                               |
| `listUserMemories()`   | POST /memories/user         | `{limit}`                                             |
| `addMemory()`          | POST /memories              | `{content, containerTag, metadata?}`                  |
| `deleteMemory()`       | DELETE /memories/:id        | —                                                     |
| `ingestConversation()` | POST /conversations         | `{conversationId, messages, containerTags, metadata}` |
| `getJobStatus()`       | GET /conversations/jobs/:id | —                                                     |

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
