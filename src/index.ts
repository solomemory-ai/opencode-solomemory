import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Agent, Event, Part } from "@opencode-ai/sdk";

import { CONFIG, isConfigured } from "./config.js";
import { solomemoryClient } from "./services/client.js";
import { formatContextForPrompt } from "./services/context.js";
import { reportError } from "./services/error-reporter.js";
import { getGitRemoteOrigin } from "./services/git.js";
import { log } from "./services/logger.js";
import type { Tags } from "./services/tags.js";
import { getTags } from "./services/tags.js";
import { subagentSessions } from "./state.js";
import { handleSessionCompacted, handleSessionIdle, sessionSyncState } from "./sync.js";
import { executeTool, TOOL_DESCRIPTION, type ToolArgs } from "./tools.js";
import type { ProjectScope } from "./types/index.js";

declare const PKG_VERSION: string;

const CONTEXT_PREVIEW_LENGTH = 100;

const injectedSessions = new Set<string>();

let subagentNames: Set<string> | undefined;

async function loadSubagentNames(client: PluginInput["client"]): Promise<void> {
  const TIMEOUT_MS = 5000;
  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("timeout"));
      }, TIMEOUT_MS);
    });
    const response = await Promise.race([client.app.agents(), timeout]);
    const agents: Agent[] = response.data ?? [];
    subagentNames = new Set(agents.filter((a) => a.mode === "subagent").map((a) => a.name));
    log("loaded subagent names", { names: [...subagentNames] });
  } catch (error) {
    log("failed to load subagent names", {
      error: error instanceof Error ? error.message : String(error),
    });
    reportError(error, { context: "loadSubagentNames" });
  }
}

function isSubagentAgent(agentName: string | undefined): boolean {
  if (agentName === undefined || subagentNames === undefined) return false;
  return subagentNames.has(agentName);
}

function extractUserMessage(parts: Part[]): string | null {
  const textParts = parts.filter(
    (p): p is Part & { type: "text"; text: string } => p.type === "text",
  );

  if (textParts.length === 0) return null;

  const message = textParts.map((p) => p.text).join("\n");
  return message.trim().length > 0 ? message : null;
}

interface ContextInjectionInput {
  sessionID: string;
  messageID: string;
  userMessage: string;
  projectScope: ProjectScope;
}

async function fetchAndInjectContext(input: ContextInjectionInput, parts: Part[]): Promise<void> {
  const start = Date.now();

  const [profileResult, userMemoriesResult, topicsResult] = await Promise.all([
    solomemoryClient.getProfile(),
    solomemoryClient.searchUserMemories(input.userMessage),
    solomemoryClient.getTopics(input.projectScope, CONFIG.maxProjectMemories),
  ]);

  const profile = profileResult.success ? profileResult : null;
  const userMemories = userMemoriesResult.success ? userMemoriesResult : { results: [] };
  const topicsList = topicsResult.success ? topicsResult.topics : [];

  const memoryContext = formatContextForPrompt(profile, userMemories, topicsList);

  if (!memoryContext) return;

  const contextPart: Part = {
    id: `solomemory-context-${String(Date.now())}`,
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "text",
    text: memoryContext,
    synthetic: true,
  };

  parts.unshift(contextPart);

  const duration = Date.now() - start;
  log("chat.message: context injected", { duration, contextLength: memoryContext.length });
  log("chat.message: injected content", { context: memoryContext });
}

interface ChatMessageInput {
  readonly sessionID: string;
  readonly agentName: string | undefined;
  readonly projectScope: ProjectScope;
  readonly client: PluginInput["client"];
}

async function hasExistingMessages(client: PluginInput["client"], sid: string): Promise<boolean> {
  try {
    const res = await client.session.messages({ path: { id: sid }, query: { limit: 1 } });
    const messages = res.data ?? [];
    return messages.length > 0;
  } catch {
    return false;
  }
}

function shouldSkipSession(sessionID: string, agentName: string | undefined): boolean {
  if (subagentSessions.has(sessionID)) return true;
  if (isSubagentAgent(agentName)) {
    subagentSessions.add(sessionID);
    log("chat.message: skipping subagent session", { sessionID, agentName });
    return true;
  }
  return false;
}

async function handleChatMessage(
  input: ChatMessageInput,
  output: { message: { id: string }; parts: Part[] },
): Promise<void> {
  const { sessionID, agentName, projectScope, client } = input;

  if (shouldSkipSession(sessionID, agentName)) return;

  const userMessage = extractUserMessage(output.parts);
  if (userMessage === null) return;

  log("chat.message: processing", {
    messagePreview: userMessage.slice(0, CONTEXT_PREVIEW_LENGTH),
    partsCount: output.parts.length,
  });

  if (injectedSessions.has(sessionID)) return;

  if (await hasExistingMessages(client, sessionID)) {
    injectedSessions.add(sessionID);
    log("chat.message: skipping injection for existing session", { sessionID });
    return;
  }

  injectedSessions.add(sessionID);
  await fetchAndInjectContext(
    { sessionID, messageID: output.message.id, userMessage, projectScope },
    output.parts,
  );
}

interface PluginContext {
  readonly ctx: PluginInput;
  readonly directory: string;
  tags: Tags | null;
}

function cleanupDeletedSession(sessionId: string): void {
  injectedSessions.delete(sessionId);
  subagentSessions.delete(sessionId);
  sessionSyncState.delete(sessionId);
  log("event: cleaned up session state", { sessionID: sessionId });
}

async function ensureTags(context: PluginContext): Promise<Tags> {
  if (context.tags !== null) return context.tags;
  const tags = await getTags(context.directory);
  context.tags = tags;
  log("lazy-loaded tags", { tags });
  return tags;
}

async function handleCompactedEvent(context: PluginContext, sessionID: string): Promise<void> {
  try {
    const tags = await ensureTags(context);
    await handleSessionCompacted({
      sessionID,
      ctx: context.ctx,
      directory: context.directory,
      tags,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("event: session compacted error", { sessionID, error: msg });
    reportError(error, { context: "handleEvent:session.compacted", sessionID });
  }
}

async function handleIdleEvent(context: PluginContext, sessionID: string): Promise<void> {
  try {
    const tags = await ensureTags(context);
    await handleSessionIdle({ sessionID, ctx: context.ctx, directory: context.directory, tags });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("event: conversation sync error", { sessionID, error: msg });
    reportError(error, { context: "handleEvent:session.idle", sessionID });
  }
}

async function handleEvent(event: Event, context: PluginContext): Promise<void> {
  if (event.type === "session.deleted") {
    cleanupDeletedSession(event.properties.info.id);
  }

  if (event.type === "session.compacted") {
    await handleCompactedEvent(context, event.properties.sessionID);
    return;
  }

  if (event.type !== "session.idle" || !isConfigured() || !CONFIG.autoSyncConversations) {
    return;
  }

  await handleIdleEvent(context, event.properties.sessionID);
}

function resolveProjectScope(directory: string): ProjectScope {
  const repository = getGitRemoteOrigin(directory);
  if (repository) return { field: "repository", value: repository };
  return { field: "directory", value: directory };
}

interface InitResult {
  projectScope: ProjectScope;
  pluginContext: PluginContext;
}

function initPlugin(ctx: PluginInput): InitResult {
  const version = typeof PKG_VERSION === "string" ? PKG_VERSION : "unknown";
  const { directory } = ctx;
  const projectScope = resolveProjectScope(directory);

  log(`oc-solomemory v${version}`, { directory, projectScope, configured: isConfigured() });
  void ctx.client.tui.showToast({
    body: { message: `oc-solomemory v${version}`, variant: "info" },
  });
  void loadSubagentNames(ctx.client);

  if (!isConfigured()) {
    log("Plugin disabled - SOLOMEMORY_API_KEY not set");
  }

  return { projectScope, pluginContext: { ctx, directory, tags: null } };
}

// eslint-disable-next-line @typescript-eslint/require-await
export const SolomemoryPlugin: Plugin = async (ctx: PluginInput) => {
  const { projectScope, pluginContext } = initPlugin(ctx);

  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "chat.message": async (input, output) => {
      if (!isConfigured()) return;

      try {
        await handleChatMessage(
          { sessionID: input.sessionID, agentName: input.agent, projectScope, client: ctx.client },
          output,
        );
      } catch (error) {
        log("chat.message: ERROR", { error: String(error) });
        reportError(error, { context: "chat.message", sessionID: input.sessionID });
      }
    },

    tool: {
      solomemory: tool({
        description: TOOL_DESCRIPTION,
        args: {
          mode: tool.schema.enum(["search", "profile", "list", "projects", "help"]).optional(),
          query: tool.schema.string().optional(),
          scope: tool.schema.enum(["user", "project", "global"]).optional(),
          limit: tool.schema.number().optional(),
          path: tool.schema.string().optional(),
          containerTag: tool.schema.string().optional(),
        },
        execute(args: ToolArgs) {
          return executeTool(args, projectScope);
        },
      }),
    },

    event: async (input) => {
      await handleEvent(input.event, pluginContext);
    },
  };
};

export default SolomemoryPlugin;
