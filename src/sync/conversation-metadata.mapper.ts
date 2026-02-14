/**
 * Conversation metadata assembly.
 * Builds the metadata record sent alongside ingested conversations.
 */

import { CONFIG } from "../config.js";
import { detectFramework, detectLanguages, detectPackageManager } from "../services/detectors.js";
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

function orEmpty(value: string | null): string {
  return value ?? "";
}

export async function buildConversationMetadata(
  input: MetadataInput,
  rawMessageCount: number,
): Promise<Record<string, string | number | boolean | string[]>> {
  const { sessionID, directory } = input;
  const gitRoot = getGitRepoRoot(directory);
  const workspace = getWorkspaceInfo(directory, gitRoot);

  const [languages, framework] = await Promise.all([
    detectLanguages(directory),
    detectFramework(directory),
  ]);

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
    branch: orEmpty(gitRoot ? getGitBranch(directory) : null),
    gitAuthor: orEmpty(gitRoot ? getGitAuthor(directory) : null),
    gitStatus: orEmpty(gitRoot ? getGitStatus(directory) : null),
    workspace: orEmpty(workspace?.name ?? null),
    workspaceType: orEmpty(workspace?.type ?? null),
    isMonorepo: isMonorepo(directory),
    machine: getMachineId(),
    os: getOS(),
    nodeVersion: getNodeVersion(),
    languages: languages.map((l) => l.replaceAll(/[^a-zA-Z0-9_-]/g, "_")),
    packageManager: orEmpty(detectPackageManager(directory)),
    framework: orEmpty(framework),
  };
}
