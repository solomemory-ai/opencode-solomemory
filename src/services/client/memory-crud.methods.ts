/**
 * Memory CRUD operations: ingest and list
 * memories by project container, user scope, or globally.
 */

import type { ProjectScope } from "../../types/index.js";
import type { IngestPayload, IngestResult, ListMemoriesResult } from "../client-types.js";
import {
  isIngestResponse,
  isListMemoriesResponse,
  listFailure,
  toErrorMessage,
} from "../client-types.js";
import { reportError } from "../error-reporter.js";
import { log } from "../logger.js";
import { DEFAULT_PAGE_SIZE, post, postWithRetry } from "./api-transport.http.js";

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

/** List memories within a specific project scope (by repository or directory). */
export async function listMemories(
  scope: ProjectScope,
  limit = DEFAULT_PAGE_SIZE,
): Promise<ListMemoriesResult> {
  log("listMemories: start", { scope, limit });
  try {
    const body = {
      metadataFilters: [{ field: scope.field, operator: "eq", value: scope.value }],
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
    reportError(error, { context: "client:listMemories", scope });
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
