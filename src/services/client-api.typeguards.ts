/**
 * Runtime type guards for API responses and failure factory utilities.
 * Each guard validates the shape of an unknown API response.
 */

import type { IngestResponse, JobStatus } from "../types/index.js";
import type {
  GetTopicsResult,
  ListMemoriesResponse,
  ListMemoriesResult,
  ProfileResponse,
  ProjectsResponse,
  SearchMemoriesResult,
  SearchResponse,
  TopicsResponse,
} from "./client-api.types.js";

// ── Internal helper ───────────────────────────────────────

function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

// ── Type guards ───────────────────────────────────────────

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

export function isListMemoriesResponse(data: unknown): data is ListMemoriesResponse {
  return isObject(data) && "memories" in data && Array.isArray(data.memories);
}

export function isIngestResponse(data: unknown): data is IngestResponse {
  if (!isObject(data)) return false;
  return (
    "id" in data &&
    typeof data.id === "number" &&
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

export function isProjectsResponse(data: unknown): data is ProjectsResponse {
  if (!isObject(data)) return false;
  return "projects" in data && Array.isArray(data.projects) && "count" in data;
}

export function isTopicsResponse(data: unknown): data is TopicsResponse {
  return isObject(data) && "topics" in data && Array.isArray(data.topics) && "total" in data;
}

// ── Failure factories ─────────────────────────────────────

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

export function topicsFailure(error: string): GetTopicsResult {
  return { success: false as const, error, topics: [], total: 0 };
}
