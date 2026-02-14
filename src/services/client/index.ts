/**
 * SolomemoryClient class assembly and singleton export.
 * Delegates to domain-specific method modules for search, CRUD, and queries.
 */

import type { MetadataFilter, ProjectScope } from "../../types/index.js";
import type {
  GetTopicsResult,
  IngestPayload,
  IngestResult,
  ListMemoriesResult,
  ListProjectsResult,
  ProfileResult,
  SearchMemoriesResult,
} from "../client-types.js";
import {
  ingest,
  listGlobalMemories,
  listMemories,
  listUserMemories,
} from "./memory-crud.methods.js";
import { searchGlobal, searchMemories, searchUserMemories } from "./memory-search.methods.js";
import { getProfile, getTopics, listProjects } from "./metadata-query.methods.js";

export class SolomemoryClient {
  searchMemories(
    query: string,
    scope: ProjectScope,
    options?: { metadataFilters?: MetadataFilter[]; limit?: number },
  ): Promise<SearchMemoriesResult> {
    return searchMemories(query, scope, options);
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

  ingest(payload: IngestPayload): Promise<IngestResult> {
    return ingest(payload);
  }

  listMemories(scope: ProjectScope, limit?: number): Promise<ListMemoriesResult> {
    return listMemories(scope, limit);
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

  getTopics(scope: ProjectScope, limit?: number): Promise<GetTopicsResult> {
    return getTopics(scope, limit);
  }
}

export const solomemoryClient = new SolomemoryClient();
