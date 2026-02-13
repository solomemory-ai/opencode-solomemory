/**
 * Type definitions for the conversation sync domain.
 * Shared across all sync submodules — leaf dependency with no internal imports.
 */

import type { PluginInput } from "@opencode-ai/plugin";

import type { ConversationTagsResult } from "../services/tags.js";
import type { Tags } from "../services/tags.js";
import type { ConversationMessage } from "../types/index.js";

export interface ConversationSyncState {
  lastSyncedMessageIndex: number;
  conversationId: string;
}

export interface SessionIdleInput {
  sessionID: string;
  ctx: PluginInput;
  directory: string;
  tags: Tags;
}

export interface MetadataInput {
  sessionID: string;
  directory: string;
  tags: Tags;
}

export interface IngestParams {
  syncState: ConversationSyncState;
  rawMessages: ConversationMessage[];
  conversationTags: ConversationTagsResult;
  metadata: Record<string, string | number | boolean>;
  sessionID: string;
  allMessages: unknown[];
}
