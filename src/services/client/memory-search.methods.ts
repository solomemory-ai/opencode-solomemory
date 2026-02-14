/**
 * Memory search operations: full-text search across project, user, global,
 * and metadata-filtered scopes. All return discriminated union results.
 */

import { CONFIG } from "../../config.js";
import type { MetadataFilter, ProjectScope } from "../../types/index.js";
import type { SearchMemoriesResult } from "../client-types.js";
import { isSearchResponse, searchFailure, toErrorMessage } from "../client-types.js";
import { reportError } from "../error-reporter.js";
import { log } from "../logger.js";
import { post } from "./api-transport.http.js";

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

/** Search memories within a specific project scope (by repository or directory). */
export async function searchMemories(
  query: string,
  scope: ProjectScope,
  options?: { metadataFilters?: MetadataFilter[]; limit?: number },
): Promise<SearchMemoriesResult> {
  log("searchMemories: start", { scope });
  try {
    const scopeFilter: MetadataFilter = { field: scope.field, operator: "eq", value: scope.value };
    const existingFilters = options?.metadataFilters ?? [];
    const body = buildSearchBody(query, {
      ...options,
      metadataFilters: [scopeFilter, ...existingFilters],
    });
    const result = await post("/search", body);
    if (!isSearchResponse(result)) throw new Error("Invalid search response format");
    log("searchMemories: success", { count: result.results.length });
    return { success: true as const, ...result };
  } catch (error) {
    const msg = toErrorMessage(error);
    log("searchMemories: error", { error: msg });
    reportError(error, { context: "client:searchMemories", scope });
    return searchFailure(msg);
  }
}

/** Search memories scoped to the authenticated user. */
export async function searchUserMemories(
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
    return { success: true as const, ...result };
  } catch (error) {
    const msg = toErrorMessage(error);
    log("searchUserMemories: error", { error: msg });
    reportError(error, { context: "client:searchUserMemories" });
    return searchFailure(msg);
  }
}

/** Search memories globally (no container scoping). */
export async function searchGlobal(
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
