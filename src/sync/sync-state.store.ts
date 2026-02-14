/**
 * Sync state storage and initialization.
 * Tracks per-session incremental sync position via a Map.
 */

import { CONFIG } from "../config.js";
import type { ConversationSyncState } from "./sync.types.js";

export const sessionSyncState = new Map<string, ConversationSyncState>();

export function initSyncState(sessionID: string): ConversationSyncState {
  const syncState: ConversationSyncState = {
    lastSyncedMessageIndex: -1,
    conversationId: `${CONFIG.platformIdentifier}_${sessionID}`,
  };
  sessionSyncState.set(sessionID, syncState);
  return syncState;
}
