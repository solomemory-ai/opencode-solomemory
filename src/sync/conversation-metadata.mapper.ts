/**
 * Conversation metadata assembly.
 * Builds the metadata record sent alongside ingested conversations.
 */

import { CONFIG } from "../config.js";
import { detectLanguages, detectPackageManager } from "../services/detectors.js";
import {
  getGitAuthor,
  getGitRemoteOrigin,
  getGitRepoRoot,
  getGitStatus,
  parseRepoOwnerAndName,
} from "../services/git.js";
import {
  getConversationTags,
  getDirName,
  getNodeVersion,
  getOS,
  getParentDirName,
  getTimezone,
  isMonorepo,
} from "../services/tags.js";
import type { MetadataInput } from "./sync.types.js";

function orEmpty(value: string | null): string {
  return value ?? "";
}

export async function buildConversationMetadata(
  input: MetadataInput,
  rawMessageCount: number,
): Promise<Record<string, string | number | boolean>> {
  const { sessionID, directory, tags } = input;
  const [conversationTags, languages] = await Promise.all([
    getConversationTags(tags, sessionID, directory),
    detectLanguages(directory),
  ]);
  const gitRoot = getGitRepoRoot(directory);
  const gitRemote = gitRoot ? getGitRemoteOrigin(directory) : null;
  const { owner: repoOwner, name: repoName } = parseRepoOwnerAndName(gitRemote);

  return {
    platform: CONFIG.platformIdentifier,
    sessionId: sessionID,
    syncedAt: new Date().toISOString(),
    timezone: getTimezone(),
    messageCount: rawMessageCount,
    directory,
    cwd: getDirName(directory),
    parentDir: getParentDirName(directory),
    repository: orEmpty(gitRemote),
    repoOwner: orEmpty(repoOwner),
    repoName: orEmpty(repoName),
    branch: orEmpty(conversationTags.metadata.gitBranch),
    gitAuthor: orEmpty(gitRoot ? getGitAuthor(directory) : null),
    gitStatus: orEmpty(gitRoot ? getGitStatus(directory) : null),
    workspace: orEmpty(conversationTags.metadata.workspaceName),
    workspaceType: orEmpty(conversationTags.metadata.workspaceType),
    isMonorepo: isMonorepo(directory),
    machine: conversationTags.metadata.machineHostname,
    os: getOS(),
    nodeVersion: getNodeVersion(),
    languages: languages.map((l) => l.replaceAll(/[^a-zA-Z0-9_-]/g, "_")).join(","),
    packageManager: orEmpty(detectPackageManager(directory)),
  };
}
