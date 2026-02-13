/**
 * Session event handlers (orchestration layer).
 * Entry points for session.idle and session.compacted events.
 */

import { log } from "../services/logger.js";
import { getConversationTags } from "../services/tags.js";
import { subagentSessions } from "../state.js";
import {
  fetchSessionMessages,
  handleNoMessages,
  ingestAndLogResult,
} from "./conversation-ingest.service.js";
import { buildConversationMetadata } from "./conversation-metadata.mapper.js";
import { extractValidMessages } from "./session-message.validation.js";
import type { SessionIdleInput } from "./sync.types.js";

export async function handleSessionCompacted(input: SessionIdleInput): Promise<void> {
  const { sessionID, ctx, directory, tags } = input;

  const { allMessages, syncState } = await fetchSessionMessages(ctx, sessionID);
  const rawMessages = extractValidMessages(allMessages, syncState.lastSyncedMessageIndex);

  if (rawMessages.length === 0) {
    handleNoMessages(sessionID, syncState, allMessages);
    log("event: session compacted, no unsynced messages", { sessionID });
    return;
  }

  const [sessionInfo, conversationTags, metadata] = await Promise.all([
    ctx.client.session.get({ path: { id: sessionID } }),
    getConversationTags(tags, sessionID, directory),
    buildConversationMetadata({ sessionID, directory, tags }, rawMessages.length),
  ]);

  if (sessionInfo.data?.title) {
    metadata.title = sessionInfo.data.title;
  }

  await ingestAndLogResult({
    syncState,
    rawMessages,
    conversationTags,
    metadata,
    sessionID,
    allMessages,
  });

  log("event: session compacted, unsynced messages ingested", {
    sessionID,
    messageCount: rawMessages.length,
  });
}

export async function handleSessionIdle(input: SessionIdleInput): Promise<void> {
  const { sessionID, ctx, directory, tags } = input;

  if (subagentSessions.has(sessionID)) {
    log("event: skipping subagent session sync", { sessionID });
    return;
  }

  const { allMessages, syncState } = await fetchSessionMessages(ctx, sessionID);
  const rawMessages = extractValidMessages(allMessages, syncState.lastSyncedMessageIndex);

  if (rawMessages.length === 0) {
    handleNoMessages(sessionID, syncState, allMessages);
    return;
  }

  const [sessionInfo, conversationTags, metadata] = await Promise.all([
    ctx.client.session.get({ path: { id: sessionID } }),
    getConversationTags(tags, sessionID, directory),
    buildConversationMetadata({ sessionID, directory, tags }, rawMessages.length),
  ]);

  if (sessionInfo.data?.title) {
    metadata.title = sessionInfo.data.title;
  }

  await ingestAndLogResult({
    syncState,
    rawMessages,
    conversationTags,
    metadata,
    sessionID,
    allMessages,
  });
}
