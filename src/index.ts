import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Agent, Event, Part } from "@opencode-ai/sdk";

import { CONFIG, isConfigured } from "./config.js";
import { solomemoryClient } from "./services/client.js";
import { formatContextForPrompt } from "./services/context.js";
import { log } from "./services/logger.js";
import type { Tags } from "./services/tags.js";
import { getTags } from "./services/tags.js";
import { subagentSessions } from "./state.js";
import { handleSessionIdle, sessionSyncState } from "./sync.js";
import { executeTool, TOOL_DESCRIPTION, type ToolArgs } from "./tools.js";
import type { Memory } from "./types/index.js";

declare const PKG_VERSION: string;

const CONTEXT_PREVIEW_LENGTH = 100;

const injectedSessions = new Set<string>();

let subagentNames: Set<string> | undefined;

async function loadSubagentNames(client: PluginInput["client"]): Promise<Set<string>> {
  try {
    const response = await client.app.agents();
    const agents: Agent[] = response.data ?? [];
    const names = new Set(agents.filter((a) => a.mode === "subagent").map((a) => a.name));
    log("loaded subagent names", { names: [...names] });
    return names;
  } catch (error) {
    log("failed to load subagent names, using empty set", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set<string>();
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

function mapMemoriesToSearchFormat(memories: Memory[]): {
  results: {
    id: string;
    memory: string;
    similarity: number;
    title?: string;
    metadata?: Record<string, unknown>;
  }[];
  total: number;
  timing: number;
} {
  return {
    results: memories.map((m) => ({
      id: m.id,
      memory: m.summary,
      similarity: 1,
      title: m.title,
      metadata: m.metadata,
    })),
    total: memories.length,
    timing: 0,
  };
}

interface ContextInjectionInput {
  sessionID: string;
  messageID: string;
  userMessage: string;
  projectScopeTag: string;
}

async function fetchAndInjectContext(input: ContextInjectionInput, parts: Part[]): Promise<void> {
  const start = Date.now();

  const [profileResult, userMemoriesResult, projectMemoriesListResult] = await Promise.all([
    solomemoryClient.getProfile(),
    solomemoryClient.searchUserMemories(input.userMessage),
    solomemoryClient.listMemories(input.projectScopeTag, CONFIG.maxProjectMemories),
  ]);

  const profile = profileResult.success ? profileResult : null;
  const userMemories = userMemoriesResult.success ? userMemoriesResult : { results: [] };
  const projectMemoriesList = projectMemoriesListResult.success
    ? projectMemoriesListResult
    : { memories: [] };

  const projectMemories = mapMemoriesToSearchFormat(projectMemoriesList.memories);
  const memoryContext = formatContextForPrompt(profile, userMemories, projectMemories);

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
}

interface ChatMessageInput {
  readonly sessionID: string;
  readonly agentName: string | undefined;
  readonly projectScopeTag: string;
}

function handleChatMessage(
  input: ChatMessageInput,
  output: { message: { id: string }; parts: Part[] },
): Promise<void> | undefined {
  const { sessionID, agentName, projectScopeTag } = input;

  if (subagentSessions.has(sessionID)) return undefined;

  if (isSubagentAgent(agentName)) {
    subagentSessions.add(sessionID);
    log("chat.message: skipping subagent session", { sessionID, agentName });
    return undefined;
  }

  const userMessage = extractUserMessage(output.parts);
  if (userMessage === null) return undefined;

  log("chat.message: processing", {
    messagePreview: userMessage.slice(0, CONTEXT_PREVIEW_LENGTH),
    partsCount: output.parts.length,
  });

  if (injectedSessions.has(sessionID)) return undefined;

  injectedSessions.add(sessionID);
  return fetchAndInjectContext(
    { sessionID, messageID: output.message.id, userMessage, projectScopeTag },
    output.parts,
  );
}

interface PluginContext {
  readonly ctx: PluginInput;
  readonly directory: string;
  readonly tags: Tags;
}

async function handleEvent(event: Event, context: PluginContext): Promise<void> {
  if (event.type === "session.deleted") {
    const sessionId = event.properties.info.id;
    injectedSessions.delete(sessionId);
    subagentSessions.delete(sessionId);
    sessionSyncState.delete(sessionId);
    log("event: cleaned up session state", { sessionID: sessionId });
  }

  if (event.type !== "session.idle" || !isConfigured() || !CONFIG.autoSyncConversations) {
    return;
  }

  const { sessionID } = event.properties;

  try {
    await handleSessionIdle({
      sessionID,
      ctx: context.ctx,
      directory: context.directory,
      tags: context.tags,
    });
  } catch (error) {
    log("event: conversation sync error", {
      sessionID,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

interface InitResult {
  projectScopeTag: string;
  pluginContext: PluginContext;
}

function initPlugin(ctx: PluginInput): InitResult {
  const version = typeof PKG_VERSION === "string" ? PKG_VERSION : "unknown";
  const { directory } = ctx;
  const tags = getTags(directory);
  const projectScopeTag = tags.repository ?? tags.project;

  log(`oc-solomemory v${version}`, {
    directory,
    tags,
    projectScopeTag,
    configured: isConfigured(),
  });
  void ctx.client.tui.showToast({
    body: { message: `oc-solomemory v${version}`, variant: "info" },
  });
  void loadSubagentNames(ctx.client).then((names) => {
    subagentNames = names;
  });

  if (!isConfigured()) {
    log("Plugin disabled - SOLOMEMORY_API_KEY not set");
  }

  return { projectScopeTag, pluginContext: { ctx, directory, tags } };
}

export const SolomemoryPlugin: Plugin = (ctx: PluginInput) => {
  const { projectScopeTag, pluginContext } = initPlugin(ctx);

  return Promise.resolve({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "chat.message": async (input, output) => {
      if (!isConfigured()) return;

      try {
        await handleChatMessage(
          { sessionID: input.sessionID, agentName: input.agent, projectScopeTag },
          output,
        );
      } catch (error) {
        log("chat.message: ERROR", { error: String(error) });
      }
    },

    tool: {
      solomemory: tool({
        description: TOOL_DESCRIPTION,
        args: {
          mode: tool.schema.enum(["search", "profile", "list", "help"]).optional(),
          query: tool.schema.string().optional(),
          scope: tool.schema.enum(["user", "project"]).optional(),
          limit: tool.schema.number().optional(),
        },
        execute(args: ToolArgs) {
          return executeTool(args, projectScopeTag);
        },
      }),
    },

    event: async (input) => {
      await handleEvent(input.event, pluginContext);
    },
  });
};

export default SolomemoryPlugin;
