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
      (p): p is Part & { text: string } =>
        (p.type === "text" || p.type === "reasoning") &&
        "text" in p &&
        !("synthetic" in p && Boolean(p.synthetic)),
    )
    .map((p) => (p.type === "reasoning" ? `Thinking: ${p.text}` : p.text))
    .join("\n");
}
