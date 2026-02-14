/**
 * Conversation metadata assembly.
 * Builds the metadata record sent alongside ingested conversations.
 */

import { CONFIG } from "../config.js";
import { detectFrameworks, detectLanguages, detectPackageManager } from "../services/detectors.js";
import {
  getGitAuthor,
  getGitBranch,
  getGitRemoteOrigin,
  getGitRepoRoot,
  getGitStatus,
  parseRepoOwnerAndName,
} from "../services/git.js";
import {
  getDirName,
  getMachineId,
  getNodeVersion,
  getOS,
  getParentDirName,
  getTimezone,
  isMonorepo,
} from "../services/tags.js";
import { getWorkspaceInfo } from "../services/workspace.js";
import type { MetadataInput } from "./sync.types.js";

type MetadataValue = string | number | boolean | string[];

/** Remove entries with null, empty string, or empty array values */
function stripEmpty(record: Record<string, MetadataValue | null>): Record<string, MetadataValue> {
  const result: Record<string, MetadataValue> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result;
}

export async function buildConversationMetadata(
  input: MetadataInput,
  rawMessageCount: number,
): Promise<Record<string, MetadataValue>> {
  const { sessionID, directory } = input;
  const gitRoot = getGitRepoRoot(directory);
  const workspace = getWorkspaceInfo(directory, gitRoot);

  const [languages, frameworks] = await Promise.all([
    detectLanguages(directory),
    detectFrameworks(directory),
  ]);

  const gitRemote = gitRoot ? getGitRemoteOrigin(directory) : null;
  const { owner: repoOwner, name: repoName } = parseRepoOwnerAndName(gitRemote);

  return stripEmpty({
    platform: CONFIG.platformIdentifier,
    sessionId: sessionID,
    syncedAt: new Date().toISOString(),
    timezone: getTimezone(),
    messageCount: rawMessageCount,
    directory,
    cwd: getDirName(directory),
    parentDir: getParentDirName(directory),
    repository: gitRemote,
    repoOwner,
    repoName,
    branch: gitRoot ? getGitBranch(directory) : null,
    gitAuthor: gitRoot ? getGitAuthor(directory) : null,
    gitStatus: gitRoot ? getGitStatus(directory) : null,
    workspace: workspace?.name ?? null,
    workspaceType: workspace?.type ?? null,
    isMonorepo: isMonorepo(directory),
    machine: getMachineId(),
    os: getOS(),
    nodeVersion: getNodeVersion(),
    languages: languages.map((l) => l.replaceAll(/[^a-zA-Z0-9_-]/g, "_")),
    packageManager: detectPackageManager(directory),
    frameworks,
  });
}
