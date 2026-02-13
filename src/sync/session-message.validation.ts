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

export function extractValidMessages(
  allMessages: unknown[],
  startIndex: number,
): ConversationMessage[] {
  const newMessages = allMessages.slice(startIndex + 1);

  return newMessages
    .filter((msg): msg is SessionMessage => isSessionMessage(msg))
    .filter((msg) => msg.info.summary !== true)
    .map((msg) => ({
      role: msg.info.role,
      content: extractContentFromParts(msg.parts),
    }))
    .filter((m) => m.content.trim().length > 0)
    .filter((m) => !isNoiseContent(m.content));
}
