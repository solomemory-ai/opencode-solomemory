import type { PluginInput } from "@opencode-ai/plugin";

import { CONFIG } from "./config.js";
import { solomemoryClient } from "./services/client.js";
import { detectLanguage, detectPackageManager } from "./services/detectors.js";
import { reportError } from "./services/error-reporter.js";
import {
  getGitAuthor,
  getGitRemoteOrigin,
  getGitStatus,
  parseRepoOwnerAndName,
} from "./services/git.js";
import { log } from "./services/logger.js";
import { extractTextFromParts, type SessionMessage } from "./services/messages.js";
import type { Tags } from "./services/tags.js";
import {
  getConversationTags,
  getDirName,
  getNodeVersion,
  getOS,
  getParentDirName,
  getTimezone,
  isMonorepo,
} from "./services/tags.js";
import { subagentSessions } from "./state.js";
import type { ConversationMessage } from "./types/index.js";

export interface ConversationSyncState {
  lastSyncedMessageIndex: number;
  conversationId: string;
}

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

function initSyncState(sessionID: string, allMessages: unknown[]): ConversationSyncState {
  const lastUserIndex = findLastUserMessageIndex(allMessages);
  const syncState: ConversationSyncState = {
    lastSyncedMessageIndex: lastUserIndex - 1,
    conversationId: `${CONFIG.platformIdentifier}_${sessionID}`,
  };
  sessionSyncState.set(sessionID, syncState);
  return syncState;
}

const NOISE_CONTENT_PREFIXES = ["\u25A3"];

function isNoiseContent(content: string): boolean {
  return NOISE_CONTENT_PREFIXES.some((prefix) => content.startsWith(prefix));
}

function extractValidMessages(allMessages: unknown[], startIndex: number): ConversationMessage[] {
  const newMessages = allMessages.slice(startIndex + 1);

  return newMessages
    .filter((msg): msg is SessionMessage => isSessionMessage(msg))
    .filter((msg) => msg.info.summary !== true)
    .map((msg) => ({
      role: msg.info.role,
      content: extractTextFromParts(msg.parts),
    }))
    .filter((m) => m.content.trim().length > 0)
    .filter((m) => !isNoiseContent(m.content));
}

interface MetadataInput {
  sessionID: string;
  directory: string;
  tags: Tags;
}

function orEmpty(value: string | null): string {
  return value ?? "";
}

async function buildConversationMetadata(
  input: MetadataInput,
  rawMessageCount: number,
): Promise<Record<string, string | number | boolean>> {
  const { sessionID, directory, tags } = input;
  const [conversationTags, language] = await Promise.all([
    getConversationTags(tags, sessionID, directory),
    detectLanguage(directory),
  ]);
  const gitRemote = getGitRemoteOrigin(directory);
  const { owner: repoOwner, name: repoName } = parseRepoOwnerAndName(gitRemote);

  return {
    platform: CONFIG.platformIdentifier,
    sessionId: sessionID,
    syncedAt: new Date().toISOString(),
    timezone: getTimezone(),
    messageCount: rawMessageCount,
    directory,
    cwd: getDirName(directory),
    parentDir: getParentDirName(directory),
    repository: orEmpty(gitRemote),
    repoOwner: orEmpty(repoOwner),
    repoName: orEmpty(repoName),
    branch: orEmpty(conversationTags.metadata.gitBranch),
    gitAuthor: orEmpty(getGitAuthor(directory)),
    gitStatus: orEmpty(getGitStatus(directory)),
    workspace: orEmpty(conversationTags.metadata.workspaceName),
    workspaceType: orEmpty(conversationTags.metadata.workspaceType),
    isMonorepo: isMonorepo(directory),
    machine: conversationTags.metadata.machineHostname,
    os: getOS(),
    nodeVersion: getNodeVersion(),
    language: orEmpty(language),
    packageManager: orEmpty(detectPackageManager(directory)),
  };
}

export interface SessionIdleInput {
  sessionID: string;
  ctx: PluginInput;
  directory: string;
  tags: Tags;
}

async function fetchSessionMessages(
  ctx: PluginInput,
  sessionID: string,
): Promise<{ allMessages: unknown[]; syncState: ConversationSyncState }> {
  const messagesResponse = await ctx.client.session.messages({ path: { id: sessionID } });
  const allMessages: unknown[] = messagesResponse.data ?? [];
  const syncState = sessionSyncState.get(sessionID) ?? initSyncState(sessionID, allMessages);
  return { allMessages, syncState };
}

function handleNoMessages(
  sessionID: string,
  syncState: ConversationSyncState,
  allMessages: unknown[],
): void {
  log("event: no valid messages to sync", { sessionID });
  syncState.lastSyncedMessageIndex = allMessages.length - 1;
}

interface IngestParams {
  syncState: ConversationSyncState;
  rawMessages: ConversationMessage[];
  conversationTags: Awaited<ReturnType<typeof getConversationTags>>;
  metadata: Record<string, string | number | boolean>;
  sessionID: string;
  allMessages: unknown[];
}

async function ingestAndLogResult(params: IngestParams): Promise<void> {
  const { syncState, rawMessages, conversationTags, metadata, sessionID, allMessages } = params;

  const result = await solomemoryClient.ingestConversation({
    conversationId: syncState.conversationId,
    messages: rawMessages,
    containerTags: conversationTags.containerTags,
    metadata,
  });

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

export async function handleSessionCompacted(ctx: PluginInput, sessionID: string): Promise<void> {
  const { allMessages, syncState } = await fetchSessionMessages(ctx, sessionID);
  syncState.lastSyncedMessageIndex = allMessages.length - 1;
  log("event: session compacted, sync state reset", {
    sessionID,
    totalMessages: allMessages.length,
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
