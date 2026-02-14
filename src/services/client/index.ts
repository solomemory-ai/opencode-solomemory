/**
 * SolomemoryClient class assembly and singleton export.
 * Delegates to domain-specific method modules for search, CRUD, and queries.
 */

import type { MetadataFilter } from "../../types/index.js";
import type {
  AddMemoryResult,
  DeleteMemoryResult,
  GetJobStatusResult,
  GetTopicsResult,
  IngestPayload,
  IngestResult,
  ListMemoriesResult,
  ListProjectsResult,
  MetadataSearchOptions,
  ProfileResult,
  SearchMemoriesResult,
} from "../client-types.js";
import {
  addMemory,
  deleteMemory,
  ingest,
  listGlobalMemories,
  listMemories,
  listUserMemories,
} from "./memory-crud.methods.js";
import {
  searchByMetadata,
  searchGlobal,
  searchMemories,
  searchUserMemories,
} from "./memory-search.methods.js";
import { getJobStatus, getProfile, getTopics, listProjects } from "./metadata-query.methods.js";

export class SolomemoryClient {
  searchMemories(
    query: string,
    containerTag: string,
    options?: { metadataFilters?: MetadataFilter[]; limit?: number },
  ): Promise<SearchMemoriesResult> {
    return searchMemories(query, containerTag, options);
  }

  getProfile(query?: string): Promise<ProfileResult> {
    return getProfile(query);
  }

  searchUserMemories(query: string, options?: { limit?: number }): Promise<SearchMemoriesResult> {
    return searchUserMemories(query, options);
  }

  listUserMemories(limit?: number): Promise<ListMemoriesResult> {
    return listUserMemories(limit);
  }

  addMemory(
    content: string,
    containerTag: string,
    metadata?: Record<string, string | number | boolean | string[]>,
  ): Promise<AddMemoryResult> {
    return addMemory(content, containerTag, metadata);
  }

  ingest(payload: IngestPayload): Promise<IngestResult> {
    return ingest(payload);
  }

  deleteMemory(memoryId: string): Promise<DeleteMemoryResult> {
    return deleteMemory(memoryId);
  }

  listMemories(containerTag: string, limit?: number): Promise<ListMemoriesResult> {
    return listMemories(containerTag, limit);
  }

  getJobStatus(jobId: string): Promise<GetJobStatusResult> {
    return getJobStatus(jobId);
  }

  searchByMetadata(options: MetadataSearchOptions): Promise<SearchMemoriesResult> {
    return searchByMetadata(options);
  }

  listGlobalMemories(limit?: number): Promise<ListMemoriesResult> {
    return listGlobalMemories(limit);
  }

  listProjects(): Promise<ListProjectsResult> {
    return listProjects();
  }

  searchGlobal(
    query: string,
    options?: { metadataFilters?: MetadataFilter[]; limit?: number },
  ): Promise<SearchMemoriesResult> {
    return searchGlobal(query, options);
  }

  getTopics(containerTag: string, limit?: number): Promise<GetTopicsResult> {
    return getTopics(containerTag, limit);
  }
}

export const solomemoryClient = new SolomemoryClient();
