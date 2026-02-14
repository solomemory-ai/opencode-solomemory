/**
 * Memory CRUD operations: create (add/ingest), delete, and list
 * memories by project container, user scope, or globally.
 */

import { randomUUID } from "node:crypto";

import type {
  AddMemoryResult,
  DeleteMemoryResult,
  IngestPayload,
  IngestResult,
  ListMemoriesResult,
} from "../client-types.js";
import {
  isIngestResponse,
  isListMemoriesResponse,
  listFailure,
  toErrorMessage,
} from "../client-types.js";
import { reportError } from "../error-reporter.js";
import { log } from "../logger.js";
import {
  apiRequest,
  DEFAULT_PAGE_SIZE,
  post,
  postWithRetry,
  TIMEOUT_MS,
  withTimeout,
} from "./api-transport.http.js";

/** Create a memory via the ingest pipeline with a generated sourceId. */
export async function addMemory(
  content: string,
  containerTag: string,
  metadata?: Record<string, string | number | boolean>,
): Promise<AddMemoryResult> {
  log("addMemory: start", { containerTag, contentLength: content.length });
  const result = await ingest({
    sourceId: `memory_${randomUUID()}`,
    sourceType: "memory",
    content: { text: content },
    metadata: {
      tags: [containerTag],
      ...metadata,
    },
  });
  if (!result.success) return { success: false as const, error: result.error };
  log("addMemory: success", { id: result.id });
  return { success: true as const, id: String(result.id), status: result.status };
}

/** Send a payload through the ingest pipeline. */
export async function ingest(payload: IngestPayload): Promise<IngestResult> {
  log("ingest: start", {
    sourceId: payload.sourceId,
    sourceType: payload.sourceType ?? "conversation",
  });
  try {
    const response = await postWithRetry("/ingest", payload);
    if (!isIngestResponse(response)) throw new Error("Invalid ingest response format");
    log("ingest: accepted", { id: response.id, status: response.status });
    return {
      success: true as const,
      id: response.id,
      sourceId: response.sourceId,
      status: response.status,
    };
  } catch (error) {
    const msg = toErrorMessage(error);
    log("ingest: error", { error: msg });
    reportError(error, { context: "client:ingest", sourceId: payload.sourceId });
    return { success: false as const, error: msg };
  }
}

/** Delete a single memory by its ID. */
export async function deleteMemory(memoryId: string): Promise<DeleteMemoryResult> {
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

/** List memories within a specific project container. */
export async function listMemories(
  containerTag: string,
  limit = DEFAULT_PAGE_SIZE,
): Promise<ListMemoriesResult> {
  log("listMemories: start", { containerTag, limit });
  try {
    const body = {
      metadataFilters: [{ field: "tags", operator: "eq", value: [containerTag] }],
      limit,
      order: "desc",
      sort: "createdAt",
    };
    const result = await post("/memories/list", body);
    if (!isListMemoriesResponse(result)) throw new Error("Invalid list response format");
    log("listMemories: success", { count: result.memories.length });
    return { success: true as const, ...result };
  } catch (error) {
    const msg = toErrorMessage(error);
    log("listMemories: error", { error: msg });
    reportError(error, { context: "client:listMemories", containerTag });
    return listFailure(msg);
  }
}

/** List memories scoped to the authenticated user. */
export async function listUserMemories(limit = DEFAULT_PAGE_SIZE): Promise<ListMemoriesResult> {
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

/** List memories globally (no container scoping). */
export async function listGlobalMemories(limit = DEFAULT_PAGE_SIZE): Promise<ListMemoriesResult> {
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
