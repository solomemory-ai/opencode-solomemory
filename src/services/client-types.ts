import type {
  ConversationIngestResponse,
  ConversationMessage,
  JobStatus,
  Memory,
  MetadataFilter,
} from "../types/index.js";

// ── Response shapes ────────────────────────────────────────

export interface SearchResult {
  id: string;
  memory?: string;
  chunk?: string;
  similarity: number;
  metadata?: Record<string, unknown>;
  validAt?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  timing: number;
}

export interface ProfileFact {
  fact: string;
  validAt?: string;
}

export interface ProfileResponse {
  profile: {
    static: ProfileFact[];
    dynamic: ProfileFact[];
  } | null;
}

interface AddMemoryResponse {
  id: string;
  status: string;
}

export interface ListMemoriesResponse {
  memories: Memory[];
  pagination: {
    currentPage: number;
    totalItems: number;
    totalPages: number;
  };
}

// ── Options ────────────────────────────────────────────────

export interface IngestPayload {
  readonly conversationId: string;
  readonly messages: ConversationMessage[];
  readonly containerTags: string[];
  readonly metadata?: Record<string, string | number | boolean>;
}

export interface MetadataSearchOptions {
  readonly query: string;
  readonly containerTags: string[];
  readonly metadataFilters: MetadataFilter[];
  readonly limit?: number;
}

// ── Result types ───────────────────────────────────────────

export type SearchMemoriesResult =
  | { success: true; results: SearchResult[]; total: number; timing: number }
  | { success: false; error: string; results: []; total: 0; timing: 0 };

export type ProfileResult =
  | { success: true; profile: ProfileResponse["profile"] }
  | { success: false; error: string; profile: null };

export type AddMemoryResult =
  | { success: true; id: string; status: string }
  | { success: false; error: string };

export type DeleteMemoryResult = { success: true } | { success: false; error: string };

export type ListMemoriesResult =
  | {
      success: true;
      memories: Memory[];
      pagination: ListMemoriesResponse["pagination"];
    }
  | {
      success: false;
      error: string;
      memories: [];
      pagination: { currentPage: 1; totalItems: 0; totalPages: 0 };
    };

export type IngestConversationResult =
  | { success: true; id: string; conversationId: string; status: string }
  | { success: false; error: string };

export type GetJobStatusResult =
  | { success: true; job: JobStatus }
  | { success: false; error: string };

// ── Type guards ────────────────────────────────────────────

function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

export function isSearchResponse(data: unknown): data is SearchResponse {
  if (!isObject(data)) return false;
  return (
    "results" in data &&
    Array.isArray(data.results) &&
    "total" in data &&
    typeof data.total === "number"
  );
}

export function isProfileResponse(data: unknown): data is ProfileResponse {
  if (!isObject(data) || !("profile" in data)) return false;
  if (data.profile === null) return true;
  if (!isObject(data.profile)) return false;
  return (
    "static" in data.profile &&
    Array.isArray(data.profile.static) &&
    "dynamic" in data.profile &&
    Array.isArray(data.profile.dynamic)
  );
}

export function isAddMemoryResponse(data: unknown): data is AddMemoryResponse {
  return isObject(data) && "id" in data && typeof data.id === "string";
}

export function isListMemoriesResponse(data: unknown): data is ListMemoriesResponse {
  return isObject(data) && "memories" in data && Array.isArray(data.memories);
}

export function isIngestResponse(data: unknown): data is ConversationIngestResponse {
  if (!isObject(data)) return false;
  return (
    "id" in data &&
    typeof data.id === "string" &&
    "status" in data &&
    typeof data.status === "string"
  );
}

export function isJobStatusResponse(data: unknown): data is JobStatus {
  if (!isObject(data)) return false;
  return (
    "id" in data &&
    typeof data.id === "string" &&
    "status" in data &&
    typeof data.status === "string" &&
    "progress" in data &&
    typeof data.progress === "number"
  );
}

// ── Utilities ──────────────────────────────────────────────

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function searchFailure(error: string): SearchMemoriesResult {
  return { success: false as const, error, results: [], total: 0, timing: 0 };
}

export function listFailure(error: string): ListMemoriesResult {
  return {
    success: false as const,
    error,
    memories: [],
    pagination: { currentPage: 1, totalItems: 0, totalPages: 0 },
  };
}
