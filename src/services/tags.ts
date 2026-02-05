import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { hostname, platform } from "node:os";
import path from "node:path";

import { CONFIG } from "../config.js";

const HASH_TRUNCATE_LENGTH = 16;
const REPO_PARTS_OFFSET = -2;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, HASH_TRUNCATE_LENGTH);
}

/**
 * Execute a git command safely. All commands are hardcoded by us (not user input).
 * The command parameter is validated to only contain git subcommands we control.
 * sonarjs/os-command is a false positive here - all callers pass literal strings.
 */
function execGitCommand(command: string, cwd?: string): string | null {
  try {
    // All callers pass hardcoded git commands (e.g., "git config user.email")
    // No user input is ever concatenated into the command string
    // eslint-disable-next-line sonarjs/os-command
    const result = execSync(command, {
      encoding: "utf8",
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

// ============================================================================
// GIT HELPERS
// ============================================================================

export function getGitEmail(): string | null {
  return execGitCommand("git config user.email");
}

export function getGitRemoteOrigin(directory?: string): string | null {
  const origin = execGitCommand("git config --get remote.origin.url", directory);
  if (!origin) return null;

  // Normalize git URLs to a canonical form
  // - git@github.com:org/repo.git -> github.com/org/repo
  // - https://github.com/org/repo.git -> github.com/org/repo
  // - ssh://git@github.com/org/repo.git -> github.com/org/repo
  const normalized = origin
    .replace(/^git@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^ssh:\/\/git@/, "")
    .replace(/^ssh:\/\//, "")
    .replace(/\.git$/, "")
    .replace(":", "/");

  return normalized;
}

export function getGitBranch(directory?: string): string | null {
  return execGitCommand("git rev-parse --abbrev-ref HEAD", directory);
}

export function getGitRepoRoot(directory?: string): string | null {
  return execGitCommand("git rev-parse --show-toplevel", directory);
}

export function getGitAuthor(directory?: string): string | null {
  return execGitCommand("git config user.email", directory);
}

export function getGitStatus(directory?: string): string | null {
  const status = execGitCommand("git status --porcelain", directory);
  if (status === null) return null;
  return status.trim().length === 0 ? "clean" : "dirty";
}

export function parseRepoOwnerAndName(gitRemoteOrigin: string | null): {
  owner: string | null;
  name: string | null;
} {
  if (!gitRemoteOrigin) return { owner: null, name: null };
  const parts = gitRemoteOrigin.split("/");
  if (parts.length >= 2) {
    return {
      owner: parts.at(REPO_PARTS_OFFSET) ?? null,
      name: parts.at(-1) ?? null,
    };
  }
  return { owner: null, name: null };
}

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

export function getOS(): string {
  return platform();
}

export function getNodeVersion(): string {
  return process.version;
}

export function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isMonorepo(directory: string): boolean {
  const indicators = ["pnpm-workspace.yaml", "lerna.json", "nx.json", "rush.json", "turbo.json"];
  for (const file of indicators) {
    if (existsSync(path.join(directory, file))) return true;
  }
  return false;
}

export function detectLanguage(directory: string): string | null {
  const indicators: [string, string][] = [
    ["tsconfig.json", "typescript"],
    ["package.json", "javascript"],
    ["Cargo.toml", "rust"],
    ["go.mod", "go"],
    ["pyproject.toml", "python"],
    ["requirements.txt", "python"],
    ["Gemfile", "ruby"],
    ["build.gradle", "java"],
    ["pom.xml", "java"],
    ["composer.json", "php"],
    ["mix.exs", "elixir"],
    ["pubspec.yaml", "dart"],
  ];

  for (const [file, lang] of indicators) {
    if (existsSync(path.join(directory, file))) {
      return lang;
    }
  }
  return null;
}

export function detectPackageManager(directory: string): string | null {
  const lockfiles: [string, string][] = [
    ["pnpm-lock.yaml", "pnpm"],
    ["bun.lockb", "bun"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
    ["Cargo.lock", "cargo"],
    ["go.sum", "go"],
    ["poetry.lock", "poetry"],
    ["Pipfile.lock", "pipenv"],
  ];

  for (const [file, pm] of lockfiles) {
    if (existsSync(path.join(directory, file))) {
      return pm;
    }
  }
  return null;
}

export function getParentDirName(directory: string): string {
  return path.basename(path.dirname(directory));
}

export function getDirName(directory: string): string {
  return path.basename(directory);
}

// ============================================================================
// MACHINE HELPERS
// ============================================================================

export function getMachineId(): string {
  // Use hostname as machine identifier
  // Could be enhanced with machine-id on Linux or IOPlatformUUID on macOS
  return hostname() || "unknown";
}

import { getWorkspaceInfo } from "./workspace.js";

// ============================================================================
// TAG GENERATION
// ============================================================================

// User identity is derived from API key on server - never sent from client

export function getRepositoryTag(directory: string): string | null {
  const origin = getGitRemoteOrigin(directory);
  if (!origin) return null;
  return `${CONFIG.containerTagPrefix}_repo_${sha256(origin)}`;
}

export function getProjectTag(directory: string): string {
  return `${CONFIG.containerTagPrefix}_project_${sha256(directory)}`;
}

export function getBranchTag(directory: string): string | null {
  const branch = getGitBranch(directory);
  if (!branch) return null;
  // Don't hash branch name - it's useful to see in queries
  // But sanitize it for use as a tag
  const sanitized = branch.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  return `branch_${sanitized}`;
}

export function getMachineTag(): string {
  return `machine_${sha256(getMachineId())}`;
}

export function getWorkspaceTag(directory: string): string | null {
  const gitRoot = getGitRepoRoot(directory);
  const workspace = getWorkspaceInfo(directory, gitRoot);
  if (!workspace) return null;
  const sanitized = workspace.name.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  return `workspace_${sanitized}`;
}

export function getPlatformTag(): string {
  return `platform_${CONFIG.platformIdentifier}`;
}

export function getSessionTag(sessionId: string): string {
  return `session_${sessionId}`;
}

// ============================================================================
// MAIN TAGS INTERFACE
// ============================================================================

export interface Tags {
  project: string;
  repository: string | null;
  workspace: string | null;
  branch: string | null;
  machine: string;
  platform: string;
}

export interface TagMetadata extends Tags {
  gitRemoteOrigin: string | null;
  gitBranch: string | null;
  workspaceName: string | null;
  workspaceType: string | null;
  machineHostname: string;
}

export function getTags(directory: string): Tags {
  return {
    project: getProjectTag(directory),
    repository: getRepositoryTag(directory),
    workspace: getWorkspaceTag(directory),
    branch: getBranchTag(directory),
    machine: getMachineTag(),
    platform: getPlatformTag(),
  };
}

export function getTagMetadata(directory: string): TagMetadata {
  const tags = getTags(directory);
  const gitRoot = getGitRepoRoot(directory);
  const workspace = getWorkspaceInfo(directory, gitRoot);

  return {
    ...tags,
    gitRemoteOrigin: getGitRemoteOrigin(directory),
    gitBranch: getGitBranch(directory),
    workspaceName: workspace?.name ?? null,
    workspaceType: workspace?.type ?? null,
    machineHostname: getMachineId(),
  };
}

// ============================================================================
// CONVERSATION TAGS
// ============================================================================

export interface ConversationTagsResult {
  // Tags used as containerTags for filtering
  containerTags: string[];

  // All tag values for metadata storage
  metadata: TagMetadata & {
    sessionTag: string;
  };
}

export function getConversationTags(
  tags: Tags,
  sessionId: string,
  directory: string,
): ConversationTagsResult {
  const sessionTag = getSessionTag(sessionId);
  const metadata = getTagMetadata(directory);

  const containerTags: string[] = [];

  if (tags.repository) {
    containerTags.push(tags.repository);
  }

  containerTags.push(tags.project);

  if (tags.workspace) {
    containerTags.push(tags.workspace);
  }

  if (tags.branch) {
    containerTags.push(tags.branch);
  }

  containerTags.push(tags.platform);

  return {
    containerTags,
    metadata: {
      ...metadata,
      sessionTag,
    },
  };
}
