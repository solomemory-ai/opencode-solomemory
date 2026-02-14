/**
 * Metadata query operations: user profile, job status,
 * project listing, and topic retrieval.
 */

import type { ProjectScope } from "../../types/index.js";
import type { GetTopicsResult, ListProjectsResult, ProfileResult } from "../client-types.js";
import {
  isProfileResponse,
  isProjectsResponse,
  isTopicsResponse,
  toErrorMessage,
  topicsFailure,
} from "../client-types.js";
import { reportError } from "../error-reporter.js";
import { log } from "../logger.js";
import { DEFAULT_PAGE_SIZE, get } from "./api-transport.http.js";

/** Fetch the authenticated user's profile, optionally filtered by query. */
export async function getProfile(query?: string): Promise<ProfileResult> {
  log("getProfile: start", { query });
  try {
    const endpoint = query ? "/profile?q=" + encodeURIComponent(query) : "/profile";
    const result = await get(endpoint);
    if (!isProfileResponse(result)) throw new Error("Invalid profile response format");
    log("getProfile: success", { hasProfile: result.profile !== null });
    return { success: true as const, ...result };
  } catch (error) {
    const msg = toErrorMessage(error);
    log("getProfile: error", { error: msg });
    reportError(error, { context: "client:getProfile" });
    return { success: false as const, error: msg, profile: null };
  }
}

/** List all projects visible to the authenticated user. */
export async function listProjects(): Promise<ListProjectsResult> {
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

/** Retrieve topic clusters for a specific project scope (by repository or directory). */
export async function getTopics(
  scope: ProjectScope,
  limit = DEFAULT_PAGE_SIZE,
): Promise<GetTopicsResult> {
  log("getTopics: start", { scope, limit });
  try {
    const filter = JSON.stringify([{ field: scope.field, operator: "eq", value: scope.value }]);
    const params = new URLSearchParams({ metadataFilters: filter, limit: String(limit) });
    const result = await get("/memories/topics?" + params.toString());
    if (!isTopicsResponse(result)) throw new Error("Invalid topics response format");
    log("getTopics: success", { count: result.topics.length });
    return { success: true as const, ...result };
  } catch (error) {
    const msg = toErrorMessage(error);
    log("getTopics: error", { error: msg });
    reportError(error, { context: "client:getTopics", scope });
    return topicsFailure(msg);
  }
}
