import { CONFIG, getApiKey, getApiUrl } from "../config.js";
import type { MemoryType, MetadataFilter } from "../types/index.js";
import type {
  AddMemoryResult,
  DeleteMemoryResult,
  GetJobStatusResult,
  IngestConversationResult,
  IngestPayload,
  ListMemoriesResult,
  ListProjectsResult,
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
  isProjectsResponse,
  isSearchResponse,
  listFailure,
  searchFailure,
  toErrorMessage,
} from "./client-types.js";
import { reportError } from "./error-reporter.js";
import { log } from "./logger.js";

const TIMEOUT_MS = 30_000;
const DEFAULT_PAGE_SIZE = 20;

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
      reportError(error, { context: "client:searchMemories", containerTag });
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
      log("getProfile: response", result);
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("getProfile: error", { error: msg });
      reportError(error, { context: "client:getProfile" });
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
        limit: options?.limit ?? CONFIG.maxMemories,
      });
      if (!isSearchResponse(result)) throw new Error("Invalid search response format");
      log("searchUserMemories: success", { count: result.results.length });
      log("searchUserMemories: response", result);
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("searchUserMemories: error", { error: msg });
      reportError(error, { context: "client:searchUserMemories" });
      return searchFailure(msg);
    }
  }

  async listUserMemories(limit = DEFAULT_PAGE_SIZE): Promise<ListMemoriesResult> {
    log("listUserMemories: start", { limit });
    try {
      const result = await post("/memories/user", { limit, order: "desc", sort: "createdAt" });
      if (!isListMemoriesResponse(result)) throw new Error("Invalid list response format");
      log("listUserMemories: success", { count: result.memories.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("listUserMemories: error", { error: msg });
      reportError(error, { context: "client:listUserMemories" });
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
      reportError(error, { context: "client:addMemory", containerTag });
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
      reportError(error, { context: "client:deleteMemory", memoryId });
      return { success: false, error: msg };
    }
  }

  async listMemories(containerTag: string, limit = DEFAULT_PAGE_SIZE): Promise<ListMemoriesResult> {
    log("listMemories: start", { containerTag, limit });
    try {
      const body = { containerTags: [containerTag], limit, order: "desc", sort: "createdAt" };
      const result = await post("/memories/list", body);
      if (!isListMemoriesResponse(result)) throw new Error("Invalid list response format");
      log("listMemories: success", { count: result.memories.length });
      log("listMemories: response", result);
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("listMemories: error", { error: msg });
      reportError(error, { context: "client:listMemories", containerTag });
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
      reportError(error, {
        context: "client:ingestConversation",
        conversationId: payload.conversationId,
      });
      return { success: false as const, error: msg };
    }
  }

  async getJobStatus(jobId: string): Promise<GetJobStatusResult> {
    try {
      const result = await get("/conversations/jobs/" + jobId);
      if (!isJobStatusResponse(result)) throw new Error("Invalid job status response format");
      return { success: true as const, job: result };
    } catch (error) {
      reportError(error, { context: "client:getJobStatus", jobId });
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
        limit: options.limit ?? CONFIG.maxMemories,
      });
      if (!isSearchResponse(result)) throw new Error("Invalid search response format");
      log("searchByMetadata: success", { count: result.results.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("searchByMetadata: error", { error: msg });
      reportError(error, { context: "client:searchByMetadata" });
      return searchFailure(msg);
    }
  }

  async listGlobalMemories(limit = DEFAULT_PAGE_SIZE): Promise<ListMemoriesResult> {
    log("listGlobalMemories: start", { limit });
    try {
      const body = { limit, order: "desc", sort: "createdAt" };
      const result = await post("/memories/list", body);
      if (!isListMemoriesResponse(result)) throw new Error("Invalid list response format");
      log("listGlobalMemories: success", { count: result.memories.length });
      return { success: true as const, ...result };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("listGlobalMemories: error", { error: msg });
      reportError(error, { context: "client:listGlobalMemories" });
      return listFailure(msg);
    }
  }

  async listProjects(): Promise<ListProjectsResult> {
    log("listProjects: start");
    try {
      const result = await get("/projects");
      if (!isProjectsResponse(result)) throw new Error("Invalid projects response format");
      log("listProjects: success", { count: result.projects.length });
      return { success: true as const, projects: result.projects };
    } catch (error) {
      const msg = toErrorMessage(error);
      log("listProjects: error", { error: msg });
      reportError(error, { context: "client:listProjects" });
      return { success: false as const, error: msg, projects: [] };
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
      reportError(error, { context: "client:searchGlobal" });
      return searchFailure(msg);
    }
  }
}

export const solomemoryClient = new SolomemoryClient();
