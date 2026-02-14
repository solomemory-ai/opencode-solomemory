/**
 * Type definitions for the conversation sync domain.
 * Shared across all sync submodules — leaf dependency with no internal imports.
 */

import type { PluginInput } from "@opencode-ai/plugin";

import type { Tags } from "../services/tags.js";
import type { ConversationMessage } from "../types/index.js";

export interface ConversationSyncState {
  lastSyncedMessageIndex: number;
  conversationId: string;
  /** Set by compacted handler to anchor the extraction start for the next idle ingest. */
  compactionAnchorIndex?: number;
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
  metadata: Record<string, string | number | boolean | string[]>;
  sessionID: string;
  allMessages: unknown[];
}
