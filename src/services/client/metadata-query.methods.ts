/**
 * Metadata query operations: user profile, job status,
 * project listing, and topic retrieval.
 */

import type {
  GetJobStatusResult,
  GetTopicsResult,
  ListProjectsResult,
  ProfileResult,
} from "../client-types.js";
import {
  isJobStatusResponse,
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

/** Check the processing status of a conversation ingestion job. */
export async function getJobStatus(jobId: string): Promise<GetJobStatusResult> {
  try {
    const result = await get("/conversations/jobs/" + jobId);
    if (!isJobStatusResponse(result)) throw new Error("Invalid job status response format");
    return { success: true as const, job: result };
  } catch (error) {
    reportError(error, { context: "client:getJobStatus", jobId });
    return { success: false as const, error: toErrorMessage(error) };
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

/** Retrieve topic clusters for a specific project container. */
export async function getTopics(
  containerTag: string,
  limit = DEFAULT_PAGE_SIZE,
): Promise<GetTopicsResult> {
  log("getTopics: start", { containerTag, limit });
  try {
    const params = new URLSearchParams({ containerTags: containerTag, limit: String(limit) });
    const result = await get("/memories/topics?" + params.toString());
    if (!isTopicsResponse(result)) throw new Error("Invalid topics response format");
    log("getTopics: success", { count: result.topics.length });
    return { success: true as const, ...result };
  } catch (error) {
    const msg = toErrorMessage(error);
    log("getTopics: error", { error: msg });
    reportError(error, { context: "client:getTopics", containerTag });
    return topicsFailure(msg);
  }
}
