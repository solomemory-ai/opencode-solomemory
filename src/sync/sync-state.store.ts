/**
 * Sync state storage and initialization.
 * Tracks per-session incremental sync position via a Map.
 */

import { CONFIG } from "../config.js";
import type { SessionMessage } from "../services/messages.js";
import type { ConversationSyncState } from "./sync.types.js";

export const sessionSyncState = new Map<string, ConversationSyncState>();

function isSessionMessage(value: unknown): value is SessionMessage {
  if (typeof value !== "object" || value === null) return false;
  if (!("info" in value) || !("parts" in value)) return false;
  if (typeof value.info !== "object" || value.info === null) return false;
  if (!("role" in value.info)) return false;
  return Array.isArray(value.parts);
}

function findLastUserMessageIndex(messages: unknown[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (isSessionMessage(msg) && msg.info.role === "user") {
      return i;
    }
  }
  return -1;
}

export function initSyncState(sessionID: string, allMessages: unknown[]): ConversationSyncState {
  const lastUserIndex = findLastUserMessageIndex(allMessages);
  const syncState: ConversationSyncState = {
    lastSyncedMessageIndex: lastUserIndex - 1,
    conversationId: `${CONFIG.platformIdentifier}_${sessionID}`,
  };
  sessionSyncState.set(sessionID, syncState);
  return syncState;
}
