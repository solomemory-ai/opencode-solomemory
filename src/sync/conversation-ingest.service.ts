/**
 * Conversation ingestion service.
 * Handles fetching session messages, ingesting to API, and logging results.
 */

import type { PluginInput } from "@opencode-ai/plugin";

import { CONFIG } from "../config.js";
import { solomemoryClient } from "../services/client.js";
import type { IngestPayload } from "../services/client-types.js";
import { reportError } from "../services/error-reporter.js";
import { log } from "../services/logger.js";
import { dumpIngestPayload } from "../services/payload-dump.js";
import type { ConversationSyncState, IngestParams } from "./sync.types.js";
import { initSyncState, sessionSyncState } from "./sync-state.store.js";

export async function fetchSessionMessages(
  ctx: PluginInput,
  sessionID: string,
): Promise<{ allMessages: unknown[]; syncState: ConversationSyncState }> {
  const messagesResponse = await ctx.client.session.messages({
    path: { id: sessionID },
  });
  const allMessages: unknown[] = messagesResponse.data ?? [];
  const syncState = sessionSyncState.get(sessionID) ?? initSyncState(sessionID, allMessages);
  return { allMessages, syncState };
}

export function handleNoMessages(
  sessionID: string,
  syncState: ConversationSyncState,
  allMessages: unknown[],
): void {
  log("event: no valid messages to sync", { sessionID });
  syncState.lastSyncedMessageIndex = allMessages.length - 1;
}

export async function ingestAndLogResult(params: IngestParams): Promise<void> {
  const { syncState, rawMessages, conversationTags, metadata, sessionID, allMessages } = params;

  const payload: IngestPayload = {
    sourceId: syncState.conversationId,
    sourceType: "conversation",
    content: { messages: rawMessages },
    containerTags: conversationTags.containerTags,
    metadata,
  };

  if (CONFIG.dumpIngestPayloads) {
    await dumpIngestPayload(payload);
  }

  const result = await solomemoryClient.ingest(payload);

  if (result.success) {
    syncState.lastSyncedMessageIndex = allMessages.length - 1;
    log("event: conversation synced", {
      sessionID,
      messageCount: rawMessages.length,
      totalMessages: allMessages.length,
    });
  } else {
    log("event: conversation sync failed", {
      sessionID,
      error: result.error,
    });
    reportError(result.error, { context: "ingestAndLogResult", sessionID });
  }
}
