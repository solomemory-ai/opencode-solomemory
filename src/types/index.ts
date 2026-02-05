export type Result<T, E = string> = { success: true; data: T } | { success: false; error: E };

export type MemoryScope = "user" | "project";

export type MemoryType =
  | "project-config"
  | "architecture"
  | "error-solution"
  | "preference"
  | "learned-pattern"
  | "conversation";

export interface Memory {
  id: string;
  summary: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface ConversationMessage {
  role: string;
  content: string;
}

export interface ConversationMetadata {
  platform: string;
  sessionId: string;
  agent?: string;
  model?: string;
  directory?: string;
  timestamp?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface ConversationIngestResponse {
  id: string;
  conversationId: string;
  status: string;
  message?: string;
}

export interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  total: number;
  message: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetadataFilter {
  field: string;
  value: string | number | boolean;
  operator?: "eq" | "ne" | "contains";
}
