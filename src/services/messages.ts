import type { Part } from "@opencode-ai/sdk";

import type { ConversationMessage } from "../types/index.js";

export interface MessageInfo {
  id: string;
  role: string;
  sessionID: string;
  providerID?: string;
  modelID?: string;
  tokens?: {
    input: number;
    output: number;
    cache: { read: number; write: number };
  };
  summary?: boolean;
  finish?: boolean | string;
  time?: { created: number; completed?: number };
}

export interface SessionMessage {
  info: MessageInfo;
  parts: Part[];
}

export function extractContentFromParts(parts: Part[]): string {
  return parts
    .filter(
      (p): p is Part & { type: "text"; text: string } =>
        p.type === "text" && "text" in p && !("synthetic" in p && Boolean(p.synthetic)),
    )
    .map((p) => p.text)
    .join("\n");
}

export function extractReasoningText(parts: Part[]): string {
  return parts
    .filter(
      (p): p is Part & { type: "reasoning"; text: string } => p.type === "reasoning" && "text" in p,
    )
    .map((p) => p.text)
    .join("\n");
}

/**
 * Input fields to try (in priority order) when tool title is empty.
 * Matches the fallback strategy used by OpenCode's own CLI (run.ts).
 */
const TITLE_FALLBACK_FIELDS = [
  "pattern",
  "filePath",
  "description",
  "command",
  "url",
  "query",
] as const;

function resolveToolTitle(title: string, input: Record<string, unknown>): string {
  if (title) return title;

  for (const field of TITLE_FALLBACK_FIELDS) {
    const value = input[field];
    if (typeof value === "string" && value) return value;
  }

  return "";
}

/** Max chars of tool output to include in conversation messages. */
const MAX_TOOL_OUTPUT_CHARS = 1000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_TOOL_OUTPUT_CHARS) return output;
  return `${output.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n… (truncated)`;
}

function formatToolContent(tool: string, title: string, output?: string): string {
  const header = title ? `${tool}: ${title}` : tool;
  if (!output?.trim()) return header;
  return `${header}\n${output}`;
}

function stripDirectoryPrefix(title: string, directory: string): string {
  const prefix = directory.startsWith("/") ? directory.slice(1) : directory;
  if (prefix && title.startsWith(`${prefix}/`)) {
    return title.slice(prefix.length + 1);
  }
  return title;
}

export function extractToolEntries(parts: Part[], directory: string): ConversationMessage[] {
  const results: ConversationMessage[] = [];
  for (const part of parts) {
    if (part.type === "tool" && part.state.status === "completed") {
      let title = resolveToolTitle(part.state.title, part.state.input);
      title = stripDirectoryPrefix(title, directory);
      const output = truncateOutput(part.state.output);
      results.push({ role: "tool", content: formatToolContent(part.tool, title, output) });
    }
  }
  return results;
}
