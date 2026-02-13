/**
 * Conversation metadata assembly.
 * Builds the metadata record sent alongside ingested conversations.
 */

import { CONFIG } from "../config.js";
import { detectLanguage, detectPackageManager } from "../services/detectors.js";
import {
  getGitAuthor,
  getGitRemoteOrigin,
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
  const [conversationTags, language] = await Promise.all([
    getConversationTags(tags, sessionID, directory),
    detectLanguage(directory),
  ]);
  const gitRemote = getGitRemoteOrigin(directory);
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
    gitAuthor: orEmpty(getGitAuthor(directory)),
    gitStatus: orEmpty(getGitStatus(directory)),
    workspace: orEmpty(conversationTags.metadata.workspaceName),
    workspaceType: orEmpty(conversationTags.metadata.workspaceType),
    isMonorepo: isMonorepo(directory),
    machine: conversationTags.metadata.machineHostname,
    os: getOS(),
    nodeVersion: getNodeVersion(),
    language: orEmpty(language),
    packageManager: orEmpty(detectPackageManager(directory)),
  };
}
