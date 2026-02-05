import { CONFIG, getApiKey, getApiUrl, isConfigured } from "../config.js";
import { log } from "./logger.js";
import type {
  MemoryType,
  Memory,
  ConversationMessage,
  ConversationIngestResponse,
  JobStatus,
  MetadataFilter,
} from "../types/index.js";

const TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

interface SearchResult {
  id: string;
  memory?: string;
  chunk?: string;
  similarity: number;
  metadata?: Record<string, unknown>;
  validAt?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  timing: number;
}

interface ProfileFact {
  fact: string;
  validAt?: string;
}

interface ProfileResponse {
  profile: {
    static: ProfileFact[];
    dynamic: ProfileFact[];
  } | null;
}

interface AddMemoryResponse {
  id: string;
  status: string;
}

interface ListMemoriesResponse {
  memories: Memory[];
  pagination: {
    currentPage: number;
    totalItems: number;
    totalPages: number;
  };
}

function isSearchResponse(data: unknown): data is SearchResponse {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.results) && typeof obj.total === "number";
}

function isProfileResponse(data: unknown): data is ProfileResponse {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return obj.profile === null || (
    typeof obj.profile === "object" &&
    obj.profile !== null &&
    Array.isArray((obj.profile as Record<string, unknown>).static) &&
    Array.isArray((obj.profile as Record<string, unknown>).dynamic)
  );
}

function isAddMemoryResponse(data: unknown): data is AddMemoryResponse {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.id === "string";
}

function isListMemoriesResponse(data: unknown): data is ListMemoriesResponse {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.memories);
}

function isConversationIngestResponse(data: unknown): data is ConversationIngestResponse {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.status === "string";
}

function isJobStatus(data: unknown): data is JobStatus {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.status === "string" && typeof obj.progress === "number";
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!isConfigured()) {
    throw new Error("SOLOMEMORY_API_KEY not set");
  }

  const url = `${getApiUrl()}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

type SearchMemoriesResult = 
  | { success: true; results: SearchResult[]; total: number; timing: number }
  | { success: false; error: string; results: []; total: 0; timing: 0 };

type ProfileResult =
  | { success: true; profile: ProfileResponse["profile"] }
  | { success: false; error: string; profile: null };

type AddMemoryResult =
  | { success: true; id: string; status: string }
  | { success: false; error: string };

type DeleteMemoryResult =
  | { success: true }
  | { success: false; error: string };

type ListMemoriesResult =
  | { success: true; memories: Memory[]; pagination: ListMemoriesResponse["pagination"] }
  | { success: false; error: string; memories: []; pagination: { currentPage: 1; totalItems: 0; totalPages: 0 } };

type IngestConversationResult =
  | { success: true; id: string; conversationId: string; status: string }
  | { success: false; error: string };

type GetJobStatusResult =
  | { success: true; job: JobStatus }
  | { success: false; error: string };

export class SolomemoryClient {
  async searchMemories(
    query: string,
    containerTag: string,
    options?: { metadataFilters?: MetadataFilter[]; limit?: number }
  ): Promise<SearchMemoriesResult> {
    log("searchMemories: start", { containerTag, hasFilters: !!options?.metadataFilters });
    try {
      const body: Record<string, unknown> = {
        q: query,
        containerTag,
        threshold: CONFIG.similarityThreshold,
        limit: options?.limit ?? CONFIG.maxMemories,
      };
      if (options?.metadataFilters?.length) {
        body.metadataFilters = options.metadataFilters;
      }
      const result = await withTimeout(
        apiRequest<unknown>("/search", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        TIMEOUT_MS
      );
      if (!isSearchResponse(result)) {
        throw new Error("Invalid search response format");
      }
      log("searchMemories: success", { count: result.results?.length || 0 });
      return { success: true as const, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("searchMemories: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, results: [], total: 0, timing: 0 };
    }
  }

  async getProfile(query?: string): Promise<ProfileResult> {
    log("getProfile: start", { query });
    try {
      const params = new URLSearchParams();
      if (query) params.append("q", query);
      
      const url = params.toString() ? `/profile?${params.toString()}` : "/profile";
      const result = await withTimeout(
        apiRequest<unknown>(url, { method: "GET" }),
        TIMEOUT_MS
      );
      if (!isProfileResponse(result)) {
        throw new Error("Invalid profile response format");
      }
      log("getProfile: success", { hasProfile: !!result?.profile });
      return { success: true as const, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("getProfile: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, profile: null };
    }
  }

  async searchUserMemories(
    query: string,
    options?: { limit?: number }
  ): Promise<SearchMemoriesResult> {
    log("searchUserMemories: start", { query });
    try {
      const result = await withTimeout(
        apiRequest<unknown>("/search/user", {
          method: "POST",
          body: JSON.stringify({
            q: query,
            threshold: CONFIG.similarityThreshold,
            limit: options?.limit ?? CONFIG.maxMemories,
          }),
        }),
        TIMEOUT_MS
      );
      if (!isSearchResponse(result)) {
        throw new Error("Invalid search response format");
      }
      log("searchUserMemories: success", { count: result.results?.length || 0 });
      return { success: true as const, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("searchUserMemories: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, results: [], total: 0, timing: 0 };
    }
  }

  async listUserMemories(limit = 20): Promise<ListMemoriesResult> {
    log("listUserMemories: start", { limit });
    try {
      const result = await withTimeout(
        apiRequest<unknown>("/memories/user", {
          method: "POST",
          body: JSON.stringify({ limit, order: "desc", sort: "createdAt" }),
        }),
        TIMEOUT_MS
      );
      if (!isListMemoriesResponse(result)) {
        throw new Error("Invalid list memories response format");
      }
      log("listUserMemories: success", { count: result.memories?.length || 0 });
      return { success: true as const, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("listUserMemories: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, memories: [], pagination: { currentPage: 1, totalItems: 0, totalPages: 0 } };
    }
  }

  async addMemory(
    content: string,
    containerTag: string,
    metadata?: { type?: MemoryType; tool?: string; [key: string]: unknown }
  ): Promise<AddMemoryResult> {
    log("addMemory: start", { containerTag, contentLength: content.length });
    try {
      const result = await withTimeout(
        apiRequest<unknown>("/memories", {
          method: "POST",
          body: JSON.stringify({
            content,
            containerTag,
            metadata,
          }),
        }),
        TIMEOUT_MS
      );
      if (!isAddMemoryResponse(result)) {
        throw new Error("Invalid add memory response format");
      }
      log("addMemory: success", { id: result.id });
      return { success: true as const, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("addMemory: error", { error: errorMessage });
      return { success: false as const, error: errorMessage };
    }
  }

  async deleteMemory(memoryId: string): Promise<DeleteMemoryResult> {
    log("deleteMemory: start", { memoryId });
    try {
      await withTimeout(
        apiRequest<void>(`/memories/${memoryId}`, {
          method: "DELETE",
        }),
        TIMEOUT_MS
      );
      log("deleteMemory: success", { memoryId });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("deleteMemory: error", { memoryId, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async listMemories(containerTag: string, limit = 20): Promise<ListMemoriesResult> {
    log("listMemories: start", { containerTag, limit });
    try {
      const result = await withTimeout(
        apiRequest<unknown>("/memories/list", {
          method: "POST",
          body: JSON.stringify({
            containerTags: [containerTag],
            limit,
            order: "desc",
            sort: "createdAt",
          }),
        }),
        TIMEOUT_MS
      );
      if (!isListMemoriesResponse(result)) {
        throw new Error("Invalid list memories response format");
      }
      log("listMemories: success", { count: result.memories?.length || 0 });
      return { success: true as const, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("listMemories: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, memories: [], pagination: { currentPage: 1, totalItems: 0, totalPages: 0 } };
    }
  }

  async ingestConversation(
    conversationId: string,
    messages: ConversationMessage[],
    containerTags: string[],
    metadata?: Record<string, string | number | boolean>
  ): Promise<IngestConversationResult> {
    const payload = { conversationId, messages, containerTags, metadata };
    log("ingestConversation: start", { conversationId, messageCount: messages.length });
    log("ingestConversation: payload", payload);
    try {
      const response = await withTimeout(
        apiRequest<unknown>("/conversations", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
        TIMEOUT_MS
      );
      if (!isConversationIngestResponse(response)) {
        throw new Error("Invalid conversation ingest response format");
      }
      log("ingestConversation: queued", { conversationId, jobId: response.id, status: response.status });
      return { success: true as const, ...response };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("ingestConversation: error", { error: errorMessage });
      return { success: false as const, error: errorMessage };
    }
  }

  async getJobStatus(jobId: string): Promise<GetJobStatusResult> {
    try {
      const result = await withTimeout(
        apiRequest<unknown>(`/conversations/jobs/${jobId}`, { method: "GET" }),
        TIMEOUT_MS
      );
      if (!isJobStatus(result)) {
        throw new Error("Invalid job status response format");
      }
      return { success: true as const, job: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false as const, error: errorMessage };
    }
  }

  async searchByMetadata(
    query: string,
    containerTags: string[],
    metadataFilters: MetadataFilter[],
    limit?: number
  ): Promise<SearchMemoriesResult> {
    log("searchByMetadata: start", { containerTags, filters: metadataFilters });
    try {
      const result = await withTimeout(
        apiRequest<unknown>("/search", {
          method: "POST",
          body: JSON.stringify({
            q: query,
            containerTags,
            metadataFilters,
            threshold: CONFIG.similarityThreshold,
            limit: limit ?? CONFIG.maxMemories,
          }),
        }),
        TIMEOUT_MS
      );
      if (!isSearchResponse(result)) {
        throw new Error("Invalid search response format");
      }
      log("searchByMetadata: success", { count: result.results?.length || 0 });
      return { success: true as const, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("searchByMetadata: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, results: [], total: 0, timing: 0 };
    }
  }

  async searchGlobal(
    query: string,
    options?: { metadataFilters?: MetadataFilter[]; limit?: number }
  ): Promise<SearchMemoriesResult> {
    log("searchGlobal: start", { hasFilters: !!options?.metadataFilters });
    try {
      const body: Record<string, unknown> = {
        q: query,
        threshold: CONFIG.similarityThreshold,
        limit: options?.limit ?? CONFIG.maxMemories,
      };
      if (options?.metadataFilters?.length) {
        body.metadataFilters = options.metadataFilters;
      }
      const result = await withTimeout(
        apiRequest<unknown>("/search", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        TIMEOUT_MS
      );
      if (!isSearchResponse(result)) {
        throw new Error("Invalid search response format");
      }
      log("searchGlobal: success", { count: result.results?.length || 0 });
      return { success: true as const, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("searchGlobal: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, results: [], total: 0, timing: 0 };
    }
  }
}

export const solomemoryClient = new SolomemoryClient();
