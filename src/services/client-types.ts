/**
 * Barrel re-export for client API types, type guards, and utilities.
 * Preserves the original import path for all consumers.
 */

export {
  isIngestResponse,
  isJobStatusResponse,
  isListMemoriesResponse,
  isProfileResponse,
  isProjectsResponse,
  isSearchResponse,
  isTopicsResponse,
  listFailure,
  searchFailure,
  toErrorMessage,
  topicsFailure,
} from "./client-api.typeguards.js";
export type {
  AddMemoryResult,
  DeleteMemoryResult,
  GetJobStatusResult,
  GetTopicsResult,
  IngestPayload,
  IngestResult,
  ListMemoriesResponse,
  ListMemoriesResult,
  ListProjectsResult,
  MetadataSearchOptions,
  ProfileFact,
  ProfileResponse,
  ProfileResult,
  ProjectInfo,
  ProjectsResponse,
  SearchMemoriesResult,
  SearchResponse,
  SearchResult,
  TopicEntry,
  TopicsResponse,
} from "./client-api.types.js";
