/**
 * Conversation sync facade.
 * Re-exports the public API consumed by src/index.ts.
 * Implementation lives in src/sync/ submodules.
 */

export { handleSessionCompacted, handleSessionIdle } from "./sync/session-event.handlers.js";
export type { ConversationSyncState, SessionIdleInput } from "./sync/sync.types.js";
export { sessionSyncState } from "./sync/sync-state.store.js";
