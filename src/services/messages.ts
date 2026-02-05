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

export function extractTextFromParts(parts: Part[]): string {
  return parts
    .filter((p): p is Part & { type: "text"; text: string } => p.type === "text" && "text" in p)
    .map((p) => p.text)
    .join("\n");
}

interface ToolPartLike {
  type: "tool";
  tool: string;
  state: { status: string };
}

function isToolPart(p: Part): p is Part & ToolPartLike {
  return p.type === "tool" && "tool" in p;
}

function getToolState(p: Part & ToolPartLike): string {
  return p.state.status;
}

export function extractToolInfoFromParts(parts: Part[]): { tool: string; state: string }[] {
  return parts
    .filter((p): p is Part & ToolPartLike => isToolPart(p))
    .map((p) => ({
      tool: p.tool,
      state: getToolState(p),
    }));
}

export function extractContentFromParts(parts: Part[]): string {
  const textContent = extractTextFromParts(parts);
  const toolParts = extractToolInfoFromParts(parts);

  if (toolParts.length === 0) return textContent;

  const toolSummary = toolParts.map((t) => `[tool: ${t.tool} (${t.state})]`).join(", ");

  return textContent ? `${textContent}\n${toolSummary}` : toolSummary;
}

function isSyntheticPart(p: Part): boolean {
  return "synthetic" in p && p.synthetic === true;
}

export function hasSyntheticPart(parts: Part[]): boolean {
  return parts.some((p) => isSyntheticPart(p));
}

export function getNonSyntheticParts(parts: Part[]): Part[] {
  return parts.filter((p) => !isSyntheticPart(p));
}

export function isNonSyntheticMessage(msg: SessionMessage): boolean {
  return !hasSyntheticPart(msg.parts);
}

/** @deprecated Use isNonSyntheticMessage instead */
export function isUserOrAssistantMessage(msg: SessionMessage): boolean {
  return (
    !hasSyntheticPart(msg.parts) && (msg.info.role === "user" || msg.info.role === "assistant")
  );
}

export function filterValidMessages(messages: SessionMessage[]): SessionMessage[] {
  return messages.filter((msg) => isNonSyntheticMessage(msg));
}
