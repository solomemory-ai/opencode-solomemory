/**
 * Session message validation, filtering, and extraction.
 * Pure functions for identifying valid messages and filtering noise.
 */

import { extractContentFromParts, type SessionMessage } from "../services/messages.js";
import type { ConversationMessage } from "../types/index.js";

const NOISE_CONTENT_PREFIXES = ["\u25A3"];

function isSessionMessage(value: unknown): value is SessionMessage {
  if (typeof value !== "object" || value === null) return false;
  if (!("info" in value) || !("parts" in value)) return false;
  if (typeof value.info !== "object" || value.info === null) return false;
  if (!("role" in value.info)) return false;
  return Array.isArray(value.parts);
}

function isNoiseContent(content: string): boolean {
  return NOISE_CONTENT_PREFIXES.some((prefix) => content.startsWith(prefix));
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

/**
 * Extract the current exchange: [last user message → end of messages].
 *
 * Each idle/compacted event should only capture the latest exchange,
 * not replay from the beginning. The lastSyncedIndex is used as a guard
 * to detect "nothing new" — if the end of the array was already synced,
 * we return empty to skip.
 *
 * Fallback: when no user message is found (e.g. post-compaction, where
 * the user message was removed from the array), extract all new messages
 * since lastSyncedIndex so orphaned assistant messages aren't lost.
 */
export function extractValidMessages(
  allMessages: unknown[],
  lastSyncedIndex: number,
): ConversationMessage[] {
  if (allMessages.length - 1 <= lastSyncedIndex) {
    return [];
  }

  const lastUserIndex = findLastUserMessageIndex(allMessages);
  const sliceStart =
    lastUserIndex === -1
      ? lastSyncedIndex + 1 // fallback: incremental from last sync
      : lastUserIndex; // normal: exchange-scoped from last user msg

  const exchangeMessages = allMessages.slice(sliceStart);

  return exchangeMessages
    .filter((msg): msg is SessionMessage => isSessionMessage(msg))
    .filter((msg) => msg.info.summary !== true)
    .map((msg) => ({
      role: msg.info.role,
      content: extractContentFromParts(msg.parts),
    }))
    .filter((m) => m.content.trim().length > 0)
    .filter((m) => !isNoiseContent(m.content));
}
