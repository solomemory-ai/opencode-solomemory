import { CONFIG, getApiKey, getApiUrl } from "../config.js";
import type { MemoryType, MetadataFilter } from "../types/index.js";
import type {
  AddMemoryResult,
  DeleteMemoryResult,
  GetJobStatusResult,
  IngestConversationResult,
  IngestPayload,
  ListMemoriesResult,
  MetadataSearchOptions,
  ProfileResult,
  SearchMemoriesResult,
} from "./client-types.js";
import {
  isAddMemoryResponse,
  isIngestResponse,
  isJobStatusResponse,
  isListMemoriesResponse,
  isProfileResponse,
  isSearchResponse,
  listFailure,
  searchFailure,
  toErrorMessage,
} from "./client-types.js";
import { log } from "./logger.js";

const TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timeout after " + String(ms) + "ms"));
      }, ms);
    }),
  ]);
}

async function apiRequest(endpoint: string, method: string, body?: string): Promise<unknown> {
  const apiKey = getApiKey();
  if (apiKey === undefined) throw new Error("SOLOMEMORY_API_KEY not set");
  const url = getApiUrl() + endpoint;
  const response = await fetch(url, {
    method,
    body,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("HTTP " + String(response.status) + ": " + errorText);
  }
  return response.json();
}

function post(endpoint: string, body: unknown): Promise<unknown> {
  return withTimeout(apiRequest(endpoint, "POST", JSON.stringify(body)), TIMEOUT_MS);
}

function get(endpoint: string): Promise<unknown> {
  return withTimeout(apiRequest(endpoint, "GET"), TIMEOUT_MS);
}

function buildSearchBody(
  query: string,
  options?: { metadataFilters?: MetadataFilter[]; limit?: number },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    q: query,
    threshold: CONFIG.similarityThreshold,
    limit: options?.limit ?? CONFIG.maxMemories,
  };
  const filters = options?.metadataFilters;
  if (filters !== undefined && filters.length > 0) body.metadataFilters = filters;
  return body;
}

export class SolomemoryClient {
  async searchMemories(
    query: string,
    containerTag: string,
    options?: { metadataFilters?: MetadataFilter[]; limit?: number },
  ): Promise<SearchMemoriesResult> {
    log("searchMemories: start", { containerTag });
    try {
      const body = buildSearchBody(query, options);
      body.containerTag = containerTag;
      const result = await post("/search", body);
      if (!isSearchResponse(result)) throw new Error("Invalid search response format");
      log("searchMemories: success", { count: result.results.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("searchMemories: error", { error: msg });
      return searchFailure(msg);
    }
  }

  async getProfile(query?: string): Promise<ProfileResult> {
    log("getProfile: start", { query });
    try {
      const params = new URLSearchParams();
      if (query) params.append("q", query);
      const qs = params.toString();
      const result = await get(qs ? "/profile?" + qs : "/profile");
      if (!isProfileResponse(result)) throw new Error("Invalid profile response format");
      log("getProfile: success", { hasProfile: result.profile !== null });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("getProfile: error", { error: msg });
      return { success: false as const, error: msg, profile: null };
    }
  }

  async searchUserMemories(
    query: string,
    options?: { limit?: number },
  ): Promise<SearchMemoriesResult> {
    log("searchUserMemories: start", { query });
    try {
      const result = await post("/search/user", {
        q: query,
        threshold: CONFIG.similarityThreshold,
        limit: options?.limit ?? CONFIG.maxMemories,
      });
      if (!isSearchResponse(result)) throw new Error("Invalid search response format");
      log("searchUserMemories: success", { count: result.results.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("searchUserMemories: error", { error: msg });
      return searchFailure(msg);
    }
  }

  async listUserMemories(limit = 20): Promise<ListMemoriesResult> {
    log("listUserMemories: start", { limit });
    try {
      const result = await post("/memories/user", { limit, order: "desc", sort: "createdAt" });
      if (!isListMemoriesResponse(result)) throw new Error("Invalid list response format");
      log("listUserMemories: success", { count: result.memories.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("listUserMemories: error", { error: msg });
      return listFailure(msg);
    }
  }

  async addMemory(
    content: string,
    containerTag: string,
    metadata?: { type?: MemoryType; tool?: string; [key: string]: unknown },
  ): Promise<AddMemoryResult> {
    log("addMemory: start", { containerTag, contentLength: content.length });
    try {
      const result = await post("/memories", { content, containerTag, metadata });
      if (!isAddMemoryResponse(result)) throw new Error("Invalid add memory response format");
      log("addMemory: success", { id: result.id });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("addMemory: error", { error: msg });
      return { success: false as const, error: msg };
    }
  }

  async deleteMemory(memoryId: string): Promise<DeleteMemoryResult> {
    log("deleteMemory: start", { memoryId });
    try {
      await withTimeout(apiRequest("/memories/" + memoryId, "DELETE"), TIMEOUT_MS);
      log("deleteMemory: success", { memoryId });
      return { success: true };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("deleteMemory: error", { memoryId, error: msg });
      return { success: false, error: msg };
    }
  }

  async listMemories(containerTag: string, limit = 20): Promise<ListMemoriesResult> {
    log("listMemories: start", { containerTag, limit });
    try {
      const body = { containerTags: [containerTag], limit, order: "desc", sort: "createdAt" };
      const result = await post("/memories/list", body);
      if (!isListMemoriesResponse(result)) throw new Error("Invalid list response format");
      log("listMemories: success", { count: result.memories.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("listMemories: error", { error: msg });
      return listFailure(msg);
    }
  }

  async ingestConversation(payload: IngestPayload): Promise<IngestConversationResult> {
    log("ingestConversation: start", {
      conversationId: payload.conversationId,
      messageCount: payload.messages.length,
    });
    log("ingestConversation: payload", payload);
    try {
      const response = await post("/conversations", payload);
      if (!isIngestResponse(response)) throw new Error("Invalid ingest response format");
      log("ingestConversation: queued", {
        conversationId: payload.conversationId,
        jobId: response.id,
        status: response.status,
      });
      return { success: true as const, ...response };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("ingestConversation: error", { error: msg });
      return { success: false as const, error: msg };
    }
  }

  async getJobStatus(jobId: string): Promise<GetJobStatusResult> {
    try {
      const result = await get("/conversations/jobs/" + jobId);
      if (!isJobStatusResponse(result)) throw new Error("Invalid job status response format");
      return { success: true as const, job: result };
    } catch (error) {
      return { success: false as const, error: toErrorMessage(error) };
    }
  }

  async searchByMetadata(options: MetadataSearchOptions): Promise<SearchMemoriesResult> {
    log("searchByMetadata: start", { containerTags: options.containerTags });
    try {
      const result = await post("/search", {
        q: options.query,
        containerTags: options.containerTags,
        metadataFilters: options.metadataFilters,
        threshold: CONFIG.similarityThreshold,
        limit: options.limit ?? CONFIG.maxMemories,
      });
      if (!isSearchResponse(result)) throw new Error("Invalid search response format");
      log("searchByMetadata: success", { count: result.results.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("searchByMetadata: error", { error: msg });
      return searchFailure(msg);
    }
  }

  async searchGlobal(
    query: string,
    options?: { metadataFilters?: MetadataFilter[]; limit?: number },
  ): Promise<SearchMemoriesResult> {
    log("searchGlobal: start");
    try {
      const body = buildSearchBody(query, options);
      const result = await post("/search", body);
      if (!isSearchResponse(result)) throw new Error("Invalid search response format");
      log("searchGlobal: success", { count: result.results.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("searchGlobal: error", { error: msg });
      return searchFailure(msg);
    }
  }
}

export const solomemoryClient = new SolomemoryClient();
