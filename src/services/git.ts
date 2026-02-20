import { execSync } from "node:child_process";

const REPO_PARTS_OFFSET = -2;

/**
 * Execute a git command safely. All commands are hardcoded by us (not user input).
 * The command parameter is validated to only contain git subcommands we control.
 * sonarjs/os-command is a false positive here - all callers pass literal strings.
 */
export function execGitCommand(command: string, cwd?: string): string | null {
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

export function getGitEmail(): string | null {
  return execGitCommand("git config user.email");
}

export function getGitRemoteOrigin(directory?: string): string | null {
  const origin = execGitCommand("git config --get remote.origin.url", directory);
  if (!origin) return null;
  return normalizeGitUrl(origin);
}

/**
 * Normalize git URLs to a canonical form, stripping credentials.
 * - git@github.com:org/repo.git           -> github.com/org/repo
 * - https://github.com/org/repo.git       -> github.com/org/repo
 * - ssh://git@github.com/org/repo.git     -> github.com/org/repo
 * - https://user:token@host.com/org/repo  -> host.com/org/repo
 * - https://oauth2/tok@host.com/org/repo  -> host.com/org/repo
 */
export function normalizeGitUrl(url: string): string {
  const stripped = url
    .replace(/^git@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^ssh:\/\/git@/, "")
    .replace(/^ssh:\/\//, "");

  // Strip embedded credentials: everything up to the last @ is credentials.
  // Handles user:pass@host, oauth2/token@host, and similar patterns.
  // The @ character is not valid in hostnames, so the last @ always
  // delimits credentials from the host portion.
  const atIndex = stripped.lastIndexOf("@");
  const withoutCredentials = atIndex === -1 ? stripped : stripped.slice(atIndex + 1);

  return withoutCredentials.replace(/\.git$/, "").replace(":", "/");
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
  try {
    // Hardcoded git command, not user input — same pattern as execGitCommand above
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = execSync("git status --porcelain", {
      encoding: "utf8",
      cwd: directory,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result.length === 0 ? "clean" : "dirty";
  } catch {
    return null;
  }
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
