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

function formatToolContent(tool: string, title: string): string {
  return `${tool}: ${title}`;
}

export function extractToolEntries(parts: Part[]): ConversationMessage[] {
  const results: ConversationMessage[] = [];
  for (const part of parts) {
    if (part.type === "tool" && part.state.status === "completed") {
      results.push({ role: "tool", content: formatToolContent(part.tool, part.state.title) });
    }
  }
  return results;
}
