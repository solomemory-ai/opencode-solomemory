/**
 * Session message validation, filtering, and extraction.
 * Pure functions for identifying valid messages and filtering noise.
 */

import {
  extractContentFromParts,
  extractReasoningText,
  extractToolEntries,
  type SessionMessage,
} from "../services/messages.js";
import type { ConversationMessage } from "../types/index.js";

const NOISE_CONTENT_PREFIXES = ["\u25A3"];
const SYNTHETIC_USER_PATTERNS = ["Continue if you have next steps"];

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

function isSyntheticUserMessage(msg: SessionMessage): boolean {
  if (msg.info.role !== "user") return false;
  const content = extractContentFromParts(msg.parts);
  return SYNTHETIC_USER_PATTERNS.some((pattern) => content.startsWith(pattern));
}

export function findLastUserMessageIndex(allMessages: unknown[]): number {
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const msg = allMessages[i];
    if (isSessionMessage(msg) && msg.info.role === "user") {
      return i;
    }
  }
  return -1;
}

export function extractValidMessages(
  allMessages: unknown[],
  extractFrom: number,
): ConversationMessage[] {
  if (allMessages.length - 1 <= extractFrom) {
    return [];
  }

  const newMessages = allMessages.slice(extractFrom + 1);

  return newMessages
    .filter((msg): msg is SessionMessage => isSessionMessage(msg))
    .filter((msg) => msg.info.summary !== true)
    .filter((msg) => !isSyntheticUserMessage(msg))
    .flatMap((msg) => {
      const results: ConversationMessage[] = [];
      const reasoning = extractReasoningText(msg.parts);
      if (reasoning.trim()) {
        results.push({ role: "thinking", content: reasoning });
      }
      const content = extractContentFromParts(msg.parts);
      if (content.trim() && !isNoiseContent(content)) {
        results.push({ role: msg.info.role, content });
      }
      results.push(...extractToolEntries(msg.parts));
      return results;
    });
}
