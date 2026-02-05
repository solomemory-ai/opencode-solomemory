import { isConfigured } from "./config.js";
import { solomemoryClient } from "./services/client.js";
import type { MemoryScope } from "./types/index.js";

const PERCENT_MULTIPLIER = 100;
const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_SEARCH_LIMIT = 10;

export interface ToolArgs {
  mode?: string;
  query?: string;
  scope?: MemoryScope;
  limit?: number;
}

interface SearchResultItem {
  id: string;
  memory?: string;
  chunk?: string;
  similarity: number;
}

interface FormatSearchInput {
  query: string;
  scope: string | undefined;
  results: SearchResultItem[];
  limit: number;
}

function errorResponse(message: string): string {
  return JSON.stringify({ success: false, error: message });
}

function formatSearchResults(input: FormatSearchInput): string {
  return JSON.stringify({
    success: true,
    query: input.query,
    scope: input.scope,
    count: input.results.length,
    results: input.results.slice(0, input.limit).map((r) => ({
      id: r.id,
      content: r.memory ?? r.chunk,
      similarity: Math.round(r.similarity * PERCENT_MULTIPLIER),
    })),
  });
}

function handleHelp(): string {
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

async function handleProfile(query: string | undefined): Promise<string> {
  const result = await solomemoryClient.getProfile(query);

  if (!result.success) {
    return errorResponse(result.error);
  }

  return JSON.stringify({
    success: true,
    profile: {
      static: result.profile?.static ?? [],
      dynamic: result.profile?.dynamic ?? [],
    },
  });
}

async function handleList(args: ToolArgs, projectScopeTag: string): Promise<string> {
  const scope = args.scope ?? "project";
  const limit = args.limit ?? DEFAULT_LIST_LIMIT;

  const result = await (scope === "user"
    ? solomemoryClient.listUserMemories(limit)
    : solomemoryClient.listMemories(projectScopeTag, limit));

  if (!result.success) {
    return errorResponse(result.error);
  }

  return JSON.stringify({
    success: true,
    scope,
    count: result.memories.length,
    memories: result.memories.map((m) => ({
      id: m.id,
      content: m.summary,
      createdAt: m.createdAt,
      metadata: m.metadata,
    })),
  });
}

async function searchUserScope(query: string, limit: number): Promise<string> {
  const result = await solomemoryClient.searchUserMemories(query);
  if (!result.success) {
    return errorResponse(result.error);
  }
  return formatSearchResults({ query, scope: "user", results: result.results, limit });
}

async function searchProjectScope(query: string, tag: string, limit: number): Promise<string> {
  const result = await solomemoryClient.searchMemories(query, tag);
  if (!result.success) {
    return errorResponse(result.error);
  }
  return formatSearchResults({ query, scope: "project", results: result.results, limit });
}

async function searchBothScopes(query: string, tag: string, limit: number): Promise<string> {
  const [userResult, projectResult] = await Promise.all([
    solomemoryClient.searchUserMemories(query),
    solomemoryClient.searchMemories(query, tag),
  ]);

  if (!userResult.success) {
    return errorResponse(userResult.error);
  }
  if (!projectResult.success) {
    return errorResponse(projectResult.error);
  }

  const combined = [
    ...userResult.results.map((r) => ({ ...r, scope: "user" as const })),
    ...projectResult.results.map((r) => ({ ...r, scope: "project" as const })),
  ].toSorted((a, b) => b.similarity - a.similarity);

  return JSON.stringify({
    success: true,
    query,
    count: combined.length,
    results: combined.slice(0, limit).map((r) => ({
      id: r.id,
      content: r.memory ?? r.chunk,
      similarity: Math.round(r.similarity * PERCENT_MULTIPLIER),
      scope: r.scope,
    })),
  });
}

async function handleSearch(args: ToolArgs, projectScopeTag: string): Promise<string> {
  if (args.query === undefined) {
    return errorResponse("query parameter is required for search mode");
  }

  const limit = args.limit ?? DEFAULT_SEARCH_LIMIT;

  if (args.scope === "user") {
    return searchUserScope(args.query, limit);
  }

  if (args.scope === "project") {
    return searchProjectScope(args.query, projectScopeTag, limit);
  }

  return searchBothScopes(args.query, projectScopeTag, limit);
}

export async function executeTool(args: ToolArgs, projectScopeTag: string): Promise<string> {
  if (!isConfigured()) {
    return errorResponse(
      "SOLOMEMORY_API_KEY not set. Set it in your environment to use Solo Memory.",
    );
  }

  const mode = args.mode ?? "help";

  try {
    switch (mode) {
      case "help": {
        return handleHelp();
      }
      case "search": {
        return await handleSearch(args, projectScopeTag);
      }
      case "profile": {
        return await handleProfile(args.query);
      }
      case "list": {
        return await handleList(args, projectScopeTag);
      }
      default: {
        return errorResponse(`Unknown mode: ${mode}`);
      }
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error));
  }
}

export const TOOL_DESCRIPTION = `Long-term memory system for user preferences, project knowledge, and past context. Memories are auto-saved from conversations.

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

EXAMPLE: {mode: "search", query: "how to run tests", scope: "project"}`;
