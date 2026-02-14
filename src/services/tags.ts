import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { hostname, platform } from "node:os";
import path from "node:path";

import { CONFIG } from "../config.js";
import { detectFramework, detectLanguages, detectPackageManager } from "./detectors.js";
import { getGitBranch, getGitRemoteOrigin, getGitRepoRoot, parseRepoOwnerAndName } from "./git.js";
import { getWorkspaceInfo } from "./workspace.js";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
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

export function getParentDirName(directory: string): string {
  return path.basename(path.dirname(directory));
}

export function getDirName(directory: string): string {
  return path.basename(directory);
}

export function getMachineId(): string {
  return hostname() || "unknown";
}

// ============================================================================
// TAG GENERATION
// ============================================================================

export function getRepositoryTag(directory: string): string | null {
  const origin = getGitRemoteOrigin(directory);
  if (!origin) return null;
  return `repo_${sha256(origin)}`;
}

export function getProjectTag(directory: string): string {
  return `proj_${sha256(directory)}`;
}

export function getBranchTag(directory: string): string | null {
  const branch = getGitBranch(directory);
  if (!branch) return null;
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

export async function getLanguageTags(directory: string): Promise<string[]> {
  const languages = await detectLanguages(directory);
  return languages.map((lang) => `lang_${lang.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}`);
}

export function getOrgTag(directory: string): string | null {
  const origin = getGitRemoteOrigin(directory);
  const { owner } = parseRepoOwnerAndName(origin);
  if (!owner) return null;
  return `org_${owner.toLowerCase()}`;
}

export function getPackageManagerTag(directory: string): string | null {
  const pm = detectPackageManager(directory);
  if (!pm) return null;
  return `pkgmgr_${pm}`;
}

export function getOsTag(): string {
  return `os_${getOS()}`;
}

export async function getFrameworkTag(directory: string): Promise<string | null> {
  const fw = await detectFramework(directory);
  if (!fw) return null;
  return `fw_${fw}`;
}

export function getPlatformTag(): string {
  return `plat_${CONFIG.platformIdentifier}`;
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
  languages: string[];
  org: string | null;
  packageManager: string | null;
  os: string;
  framework: string | null;
}

export async function getTags(directory: string): Promise<Tags> {
  const [languages, framework] = await Promise.all([
    getLanguageTags(directory),
    getFrameworkTag(directory),
  ]);

  return {
    project: getProjectTag(directory),
    repository: getRepositoryTag(directory),
    workspace: getWorkspaceTag(directory),
    branch: getBranchTag(directory),
    machine: getMachineTag(),
    platform: getPlatformTag(),
    languages,
    org: getOrgTag(directory),
    packageManager: getPackageManagerTag(directory),
    os: getOsTag(),
    framework,
  };
}
