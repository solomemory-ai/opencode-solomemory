import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { hostname, platform } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { CONFIG } from "../config.js";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function execGitCommand(command: string, cwd?: string): string | null {
  try {
    return execSync(command, { 
      encoding: "utf-8", 
      cwd,
      stdio: ["pipe", "pipe", "pipe"] 
    }).trim() || null;
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
  let normalized = origin
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

export function parseRepoOwnerAndName(gitRemoteOrigin: string | null): { owner: string | null; name: string | null } {
  if (!gitRemoteOrigin) return { owner: null, name: null };
  const parts = gitRemoteOrigin.split("/");
  if (parts.length >= 2) {
    return {
      owner: parts[parts.length - 2] ?? null,
      name: parts[parts.length - 1] ?? null,
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
  const indicators = [
    "pnpm-workspace.yaml",
    "lerna.json",
    "nx.json",
    "rush.json",
    "turbo.json",
  ];
  for (const file of indicators) {
    if (existsSync(join(directory, file))) return true;
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
    if (existsSync(join(directory, file))) {
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
    if (existsSync(join(directory, file))) {
      return pm;
    }
  }
  return null;
}

export function getParentDirName(directory: string): string {
  return basename(dirname(directory));
}

export function getDirName(directory: string): string {
  return basename(directory);
}

// ============================================================================
// MACHINE HELPERS
// ============================================================================

export function getMachineId(): string {
  // Use hostname as machine identifier
  // Could be enhanced with machine-id on Linux or IOPlatformUUID on macOS
  return hostname() || "unknown";
}

// ============================================================================
// MONOREPO / WORKSPACE HELPERS
// ============================================================================

interface WorkspaceInfo {
  name: string;
  root: string;
  type: "npm" | "pnpm" | "bun" | "yarn" | "cargo" | "go" | "unknown";
}

function findPackageJson(directory: string): string | null {
  let current = directory;
  while (current !== dirname(current)) {
    const pkgPath = join(current, "package.json");
    if (existsSync(pkgPath)) {
      return pkgPath;
    }
    current = dirname(current);
  }
  return null;
}

function findCargoToml(directory: string): string | null {
  let current = directory;
  while (current !== dirname(current)) {
    const cargoPath = join(current, "Cargo.toml");
    if (existsSync(cargoPath)) {
      return cargoPath;
    }
    current = dirname(current);
  }
  return null;
}

function findGoMod(directory: string): string | null {
  let current = directory;
  while (current !== dirname(current)) {
    const goModPath = join(current, "go.mod");
    if (existsSync(goModPath)) {
      return goModPath;
    }
    current = dirname(current);
  }
  return null;
}

export function getWorkspaceInfo(directory: string): WorkspaceInfo | null {
  const gitRoot = getGitRepoRoot(directory);
  
  // Check for JS/TS monorepo (package.json)
  const pkgPath = findPackageJson(directory);
  if (pkgPath) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const pkgDir = dirname(pkgPath);
      
      // If we're in a subdirectory of the git root, this might be a workspace package
      if (gitRoot && pkgDir !== gitRoot && pkgDir.startsWith(gitRoot)) {
        const workspaceName = pkg.name || basename(pkgDir);
        
        // Detect package manager
        let type: WorkspaceInfo["type"] = "npm";
        if (existsSync(join(gitRoot, "pnpm-workspace.yaml"))) type = "pnpm";
        else if (existsSync(join(gitRoot, "bun.lockb"))) type = "bun";
        else if (existsSync(join(gitRoot, "yarn.lock"))) type = "yarn";
        
        return {
          name: workspaceName,
          root: pkgDir,
          type,
        };
      }
      
      // Root package
      if (pkg.name) {
        return {
          name: pkg.name,
          root: pkgDir,
          type: existsSync(join(pkgDir, "bun.lockb")) ? "bun" : 
                existsSync(join(pkgDir, "pnpm-lock.yaml")) ? "pnpm" :
                existsSync(join(pkgDir, "yarn.lock")) ? "yarn" : "npm",
        };
      }
    } catch {
      // Invalid package.json
    }
  }
  
  // Check for Rust workspace (Cargo.toml)
  const cargoPath = findCargoToml(directory);
  if (cargoPath) {
    try {
      const content = readFileSync(cargoPath, "utf-8");
      const nameMatch = content.match(/^\s*name\s*=\s*"([^"]+)"/m);
      if (nameMatch?.[1]) {
        return {
          name: nameMatch[1],
          root: dirname(cargoPath),
          type: "cargo",
        };
      }
    } catch {
      // Invalid Cargo.toml
    }
  }
  
  // Check for Go module (go.mod)
  const goModPath = findGoMod(directory);
  if (goModPath) {
    try {
      const content = readFileSync(goModPath, "utf-8");
      const moduleMatch = content.match(/^module\s+(\S+)/m);
      if (moduleMatch?.[1]) {
        return {
          name: moduleMatch[1],
          root: dirname(goModPath),
          type: "go",
        };
      }
    } catch {
      // Invalid go.mod
    }
  }
  
  return null;
}

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
  const sanitized = branch.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `branch_${sanitized}`;
}

export function getMachineTag(): string {
  return `machine_${sha256(getMachineId())}`;
}

export function getWorkspaceTag(directory: string): string | null {
  const workspace = getWorkspaceInfo(directory);
  if (!workspace) return null;
  // Use workspace name directly (sanitized) - useful for filtering
  const sanitized = workspace.name.replace(/[^a-zA-Z0-9_-]/g, "_");
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
  const workspace = getWorkspaceInfo(directory);
  
  return {
    ...tags,
    gitRemoteOrigin: getGitRemoteOrigin(directory),
    gitBranch: getGitBranch(directory),
    workspaceName: workspace?.name || null,
    workspaceType: workspace?.type || null,
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

export function getConversationTags(tags: Tags, sessionId: string, directory: string): ConversationTagsResult {
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
