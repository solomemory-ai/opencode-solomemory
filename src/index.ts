import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Event, Part } from "@opencode-ai/sdk";

import { CONFIG, isConfigured } from "./config.js";
import { solomemoryClient } from "./services/client.js";
import { formatContextForPrompt } from "./services/context.js";
import { log } from "./services/logger.js";
import type { Tags } from "./services/tags.js";
import { getTags } from "./services/tags.js";
import { handleSessionIdle, sessionSyncState } from "./sync.js";
import { executeTool, TOOL_DESCRIPTION, type ToolArgs } from "./tools.js";
import type { Memory } from "./types/index.js";

const injectedSessions = new Set<string>();

function extractUserMessage(parts: Part[]): string | null {
  const textParts = parts.filter(
    (p): p is Part & { type: "text"; text: string } => p.type === "text",
  );

  if (textParts.length === 0) return null;

  const message = textParts.map((p) => p.text).join("\n");
  return message.trim().length > 0 ? message : null;
}

function mapMemoriesToSearchFormat(memories: Memory[]) {
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

async function handleChatMessage(
  sessionID: string,
  output: { message: { id: string }; parts: Part[] },
  projectScopeTag: string,
): Promise<void> {
  const userMessage = extractUserMessage(output.parts);
  if (userMessage === null) return;

  log("chat.message: processing", {
    messagePreview: userMessage.slice(0, 100),
    partsCount: output.parts.length,
  });

  if (!injectedSessions.has(sessionID)) {
    injectedSessions.add(sessionID);
    await fetchAndInjectContext(
      { sessionID, messageID: output.message.id, userMessage, projectScopeTag },
      output.parts,
    );
  }
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

export const SolomemoryPlugin: Plugin = (ctx: PluginInput) => {
  const { directory } = ctx;
  const tags = getTags(directory);
  const projectScopeTag = tags.repository ?? tags.project;
  const pluginContext: PluginContext = { ctx, directory, tags };
  log("Plugin init", { directory, tags, projectScopeTag, configured: isConfigured() });

  if (!isConfigured()) {
    log("Plugin disabled - SOLOMEMORY_API_KEY not set");
  }

  return Promise.resolve({
    "chat.message": async (input, output) => {
      if (!isConfigured()) return;

      try {
        await handleChatMessage(input.sessionID, output, projectScopeTag);
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
