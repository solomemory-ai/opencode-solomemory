/**
 * API response shapes, request option types, and discriminated union result types
 * for SolomemoryClient. Pure compile-time declarations — no runtime code.
 */

import type { JobStatus, Memory, MetadataFilter } from "../types/index.js";

// ── API response shapes ───────────────────────────────────

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

export interface ListMemoriesResponse {
  memories: Memory[];
  pagination: {
    currentPage: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ProjectInfo {
  containerTag: string;
  projectId: string;
  repository?: string;
  workspace?: string;
}

export interface ProjectsResponse {
  projects: ProjectInfo[];
  count: number;
}

export interface TopicEntry {
  id: string;
  topic: string;
  keywords?: string[];
  createdAt?: string;
}

export interface TopicsResponse {
  topics: TopicEntry[];
  total: number;
}

// ── Request option types ──────────────────────────────────

export interface IngestPayload {
  readonly sourceId: string;
  readonly sourceType?: string;
  readonly content: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
}

export interface MetadataSearchOptions {
  readonly query: string;
  readonly tags?: string[];
  readonly metadataFilters: MetadataFilter[];
  readonly limit?: number;
}

// ── Discriminated union result types ──────────────────────

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

export type IngestResult =
  | { success: true; id: number; sourceId: string; status: string }
  | { success: false; error: string };

export type GetJobStatusResult =
  | { success: true; job: JobStatus }
  | { success: false; error: string };

export type ListProjectsResult =
  | { success: true; projects: ProjectInfo[] }
  | { success: false; error: string; projects: [] };

export type GetTopicsResult =
  | { success: true; topics: TopicEntry[]; total: number }
  | { success: false; error: string; topics: []; total: 0 };
