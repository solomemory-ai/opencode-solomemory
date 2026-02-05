import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { tool } from "@opencode-ai/plugin";

import { solomemoryClient } from "./services/client.js";
import { formatContextForPrompt } from "./services/context.js";
import {
  getTags,
  getConversationTags,
  getGitAuthor,
  getGitRemoteOrigin,
  getGitStatus,
  parseRepoOwnerAndName,
  getOS,
  getNodeVersion,
  getTimezone,
  detectLanguage,
  detectPackageManager,
  getParentDirName,
  getDirName,
  isMonorepo,
} from "./services/tags.js";
import { isNonSyntheticMessage, extractTextFromParts, type SessionMessage } from "./services/messages.js";

import { isConfigured, CONFIG } from "./config.js";
import { log } from "./services/logger.js";
import type { MemoryScope, Memory, ConversationMessage } from "./types/index.js";

interface ConversationSyncState {
  lastSyncedMessageIndex: number;
  conversationId: string;
}

const sessionSyncState = new Map<string, ConversationSyncState>();

export const SolomemoryPlugin: Plugin = async (ctx: PluginInput) => {
  const { directory } = ctx;
  const tags = getTags(directory);
  const projectScopeTag = tags.repository || tags.project;
  const injectedSessions = new Set<string>();
  log("Plugin init", { directory, tags, projectScopeTag, configured: isConfigured() });

  if (!isConfigured()) {
    log("Plugin disabled - SOLOMEMORY_API_KEY not set");
  }

  return {
    "chat.message": async (input, output) => {
      if (!isConfigured()) return;

      const start = Date.now();

      try {
        const textParts = output.parts.filter(
          (p): p is Part & { type: "text"; text: string } => p.type === "text"
        );

        if (textParts.length === 0) {
          log("chat.message: no text parts found");
          return;
        }

        const userMessage = textParts.map((p) => p.text).join("\n");

        if (!userMessage.trim()) {
          log("chat.message: empty message, skipping");
          return;
        }

        log("chat.message: processing", {
          messagePreview: userMessage.slice(0, 100),
          partsCount: output.parts.length,
          textPartsCount: textParts.length,
        });

        const isFirstMessage = !injectedSessions.has(input.sessionID);

        if (isFirstMessage) {
          injectedSessions.add(input.sessionID);

          const [profileResult, userMemoriesResult, projectMemoriesListResult] = await Promise.all([
            solomemoryClient.getProfile(),
            solomemoryClient.searchUserMemories(userMessage),
            solomemoryClient.listMemories(projectScopeTag, CONFIG.maxProjectMemories),
          ]);

          const profile = profileResult.success ? profileResult : null;
          const userMemories = userMemoriesResult.success ? userMemoriesResult : { results: [] };
          const projectMemoriesList = projectMemoriesListResult.success ? projectMemoriesListResult : { memories: [] };

          const projectMemories = {
            results: (projectMemoriesList.memories || []).map((m: Memory) => ({
              id: m.id,
              memory: m.summary,
              similarity: 1,
              title: m.title,
              metadata: m.metadata,
            })),
            total: projectMemoriesList.memories?.length || 0,
            timing: 0,
          };

          const memoryContext = formatContextForPrompt(
            profile,
            userMemories,
            projectMemories
          );

          if (memoryContext) {
            const contextPart: Part = {
              id: `solomemory-context-${Date.now()}`,
              sessionID: input.sessionID,
              messageID: output.message.id,
              type: "text",
              text: memoryContext,
              synthetic: true,
            };

            output.parts.unshift(contextPart);

            const duration = Date.now() - start;
            log("chat.message: context injected", {
              duration,
              contextLength: memoryContext.length,
            });
          }
        }

      } catch (error) {
        log("chat.message: ERROR", { error: String(error) });
      }
    },

    tool: {
      solomemory: tool({
        description: `Long-term memory system for user preferences, project knowledge, and past context. Memories are auto-saved from conversations.

USE THIS TOOL WHEN:
- User asks "what do you know about X" or "do you remember Y"
- You need context not in current conversation (past decisions, preferences, patterns)
- Looking up project-specific conventions, build commands, or architecture decisions
- Checking user's coding style, preferences, or expertise areas

MODES:
- search: Semantic search for relevant memories. Requires: query. Optional: scope, limit.
- profile: User identity and preferences (static facts + recent context).
- list: Browse all memories in scope (no search, just listing).

SCOPES:
- project (default): This directory's knowledge - build commands, architecture, conventions.
- user: Cross-project knowledge - coding style, preferences, expertise.

EXAMPLE: {mode: "search", query: "how to run tests", scope: "project"}`,
        args: {
          mode: tool.schema
            .enum(["search", "profile", "list", "help"])
            .optional(),
          query: tool.schema.string().optional(),
          scope: tool.schema.enum(["user", "project"]).optional(),
          limit: tool.schema.number().optional(),
        },
        async execute(args: {
          mode?: string;
          query?: string;
          scope?: MemoryScope;
          limit?: number;
        }) {
          if (!isConfigured()) {
            return JSON.stringify({
              success: false,
              error:
                "SOLOMEMORY_API_KEY not set. Set it in your environment to use Solo Memory.",
            });
          }

          const mode = args.mode || "help";

          try {
            switch (mode) {
              case "help": {
                return JSON.stringify({
                  success: true,
                  message: "Solo Memory Usage Guide - Memories are automatically saved from conversations",
                  commands: [
                    {
                      command: "search",
                      description: "Search memories by semantic query",
                      args: ["query", "scope?", "limit?"],
                    },
                    {
                      command: "list",
                      description: "List all memories in scope",
                      args: ["scope?", "limit?"],
                    },
                    {
                      command: "profile",
                      description: "View user profile and preferences",
                      args: ["query?"],
                    },
                  ],
                  scopes: {
                    user: "Cross-project preferences and knowledge",
                    project: "Project-specific knowledge (default)",
                  },
                });
              }

              case "search": {
                if (!args.query) {
                  return JSON.stringify({
                    success: false,
                    error: "query parameter is required for search mode",
                  });
                }

                const scope = args.scope;

                if (scope === "user") {
                  const result = await solomemoryClient.searchUserMemories(args.query);
                  if (!result.success) {
                    return JSON.stringify({
                      success: false,
                      error: result.error || "Failed to search memories",
                    });
                  }
                  return formatSearchResults(args.query, scope, result, args.limit);
                }

                if (scope === "project") {
                  const result = await solomemoryClient.searchMemories(
                    args.query,
                    projectScopeTag
                  );
                  if (!result.success) {
                    return JSON.stringify({
                      success: false,
                      error: result.error || "Failed to search memories",
                    });
                  }
                  return formatSearchResults(args.query, scope, result, args.limit);
                }

                const [userResult, projectResult] = await Promise.all([
                  solomemoryClient.searchUserMemories(args.query),
                  solomemoryClient.searchMemories(args.query, projectScopeTag),
                ]);

                if (!userResult.success) {
                  return JSON.stringify({
                    success: false,
                    error: userResult.error || "Failed to search user memories",
                  });
                }
                if (!projectResult.success) {
                  return JSON.stringify({
                    success: false,
                    error: projectResult.error || "Failed to search project memories",
                  });
                }

                const combined = [
                  ...(userResult.results || []).map((r) => ({
                    ...r,
                    scope: "user" as const,
                  })),
                  ...(projectResult.results || []).map((r) => ({
                    ...r,
                    scope: "project" as const,
                  })),
                ].sort((a, b) => b.similarity - a.similarity);

                return JSON.stringify({
                  success: true,
                  query: args.query,
                  count: combined.length,
                  results: combined.slice(0, args.limit || 10).map((r) => ({
                    id: r.id,
                    content: r.memory || r.chunk,
                    similarity: Math.round(r.similarity * 100),
                    scope: r.scope,
                  })),
                });
              }

              case "profile": {
                const result = await solomemoryClient.getProfile(args.query);

                if (!result.success) {
                  return JSON.stringify({
                    success: false,
                    error: result.error || "Failed to fetch profile",
                  });
                }

                return JSON.stringify({
                  success: true,
                  profile: {
                    static: result.profile?.static || [],
                    dynamic: result.profile?.dynamic || [],
                  },
                });
              }

              case "list": {
                const scope = args.scope || "project";
                const limit = args.limit || 20;

                let result;
                if (scope === "user") {
                  result = await solomemoryClient.listUserMemories(limit);
                } else {
                  result = await solomemoryClient.listMemories(projectScopeTag, limit);
                }

                if (!result.success) {
                  return JSON.stringify({
                    success: false,
                    error: result.error || "Failed to list memories",
                  });
                }

                const memories = result.memories || [];
                return JSON.stringify({
                  success: true,
                  scope,
                  count: memories.length,
                  memories: memories.map((m) => ({
                    id: m.id,
                    content: m.summary,
                    createdAt: m.createdAt,
                    metadata: m.metadata,
                  })),
                });
              }

              default:
                return JSON.stringify({
                  success: false,
                  error: `Unknown mode: ${mode}`,
                });
            }
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }),
    },

    event: async (input: { event: { type: string; properties?: unknown } }) => {
      if (input.event.type === "session.deleted") {
        const props = input.event.properties as { info?: { id?: string } } | undefined;
        if (props?.info?.id) {
          injectedSessions.delete(props.info.id);
          sessionSyncState.delete(props.info.id);
          log("event: cleaned up session state", { sessionID: props.info.id });
        }
      }

      if (input.event.type === "session.idle" && isConfigured() && CONFIG.autoSyncConversations) {
        const props = input.event.properties as { sessionID?: string } | undefined;
        const sessionID = props?.sessionID;

        if (!sessionID) {
          return;
        }

        try {
          const messagesResponse = await ctx.client.session.messages({ path: { id: sessionID } });
          const allMessages = messagesResponse.data || [];

          let syncState = sessionSyncState.get(sessionID);
          if (!syncState) {
            let lastUserIndex = -1;
            for (let i = allMessages.length - 1; i >= 0; i--) {
              const msg = allMessages[i] as SessionMessage;
              if (msg.info.role === "user" && isNonSyntheticMessage(msg)) {
                lastUserIndex = i;
                break;
              }
            }
            syncState = {
              lastSyncedMessageIndex: lastUserIndex - 1,
              conversationId: `${CONFIG.platformIdentifier}_${sessionID}`,
            };
            sessionSyncState.set(sessionID, syncState);
          }

          const newMessages = allMessages.slice(syncState.lastSyncedMessageIndex + 1);

          if (newMessages.length === 0) {
            log("event: no new messages to sync", { sessionID });
            return;
          }

          const validMessages = (newMessages as SessionMessage[]).filter(isNonSyntheticMessage);

          if (validMessages.length === 0) {
            log("event: no valid messages after filtering", { sessionID });
            syncState.lastSyncedMessageIndex = allMessages.length - 1;
            return;
          }

          const rawMessages: ConversationMessage[] = validMessages.map((msg) => ({
            role: msg.info.role,
            content: extractTextFromParts(msg.parts),
          })).filter((m) => m.content.trim().length > 0);

          if (rawMessages.length === 0) {
            log("event: no messages with content after extraction", { sessionID });
            syncState.lastSyncedMessageIndex = allMessages.length - 1;
            return;
          }

          const sessionInfo = await ctx.client.session.get({ path: { id: sessionID } });
          const session = sessionInfo.data;

          const conversationTags = getConversationTags(tags, sessionID, directory);

          const gitRemote = getGitRemoteOrigin(directory);
          const { owner: repoOwner, name: repoName } = parseRepoOwnerAndName(gitRemote);

          const metadata: Record<string, string | number | boolean> = {
            platform: CONFIG.platformIdentifier,
            sessionId: sessionID,
            syncedAt: new Date().toISOString(),
            timezone: getTimezone(),
            messageCount: rawMessages.length,
            directory,
            cwd: getDirName(directory),
            parentDir: getParentDirName(directory),
            repository: gitRemote || "",
            repoOwner: repoOwner || "",
            repoName: repoName || "",
            branch: conversationTags.metadata.gitBranch || "",
            gitAuthor: getGitAuthor(directory) || "",
            gitStatus: getGitStatus(directory) || "",
            workspace: conversationTags.metadata.workspaceName || "",
            workspaceType: conversationTags.metadata.workspaceType || "",
            isMonorepo: isMonorepo(directory),
            machine: conversationTags.metadata.machineHostname,
            os: getOS(),
            nodeVersion: getNodeVersion(),
            language: detectLanguage(directory) || "",
            packageManager: detectPackageManager(directory) || "",
          };

          if (session?.title) {
            metadata.title = session.title;
          }

          const result = await solomemoryClient.ingestConversation(
            syncState.conversationId,
            rawMessages,
            conversationTags.containerTags,
            metadata
          );

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
          }
        } catch (error) {
          log("event: conversation sync error", {
            sessionID,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  };
};

function formatSearchResults(
  query: string,
  scope: string | undefined,
  results: { results?: Array<{ id: string; memory?: string; chunk?: string; similarity: number }> },
  limit?: number
): string {
  const memoryResults = results.results || [];
  return JSON.stringify({
    success: true,
    query,
    scope,
    count: memoryResults.length,
    results: memoryResults.slice(0, limit || 10).map((r) => ({
      id: r.id,
      content: r.memory || r.chunk,
      similarity: Math.round(r.similarity * 100),
    })),
  });
}

export default SolomemoryPlugin;
