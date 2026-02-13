# sync/

Conversation sync domain — handles incremental syncing of session messages to the solomemory API.

## What belongs here

- Session event handlers (idle, compacted)
- Message validation and extraction
- Conversation metadata assembly
- Sync state tracking
- API ingestion orchestration

## Dependency rules

- **Imports from**: `services/*`, `config.ts`, `state.ts`, `types/`
- **Imported by**: `src/sync.ts` (facade), which is consumed by `src/index.ts`
- **Internal**: `session-event.handlers.ts` orchestrates all other modules; `sync.types.ts` is the leaf

## Entry points

- `session-event.handlers.ts` — `handleSessionIdle()`, `handleSessionCompacted()`
- `sync-state.store.ts` — `sessionSyncState` Map
