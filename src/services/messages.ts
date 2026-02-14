import type { Part } from "@opencode-ai/sdk";

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
