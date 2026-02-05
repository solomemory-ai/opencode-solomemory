import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface WorkspaceInfo {
  name: string;
  root: string;
  type: "npm" | "pnpm" | "bun" | "yarn" | "cargo" | "go" | "unknown";
}

interface PackageJson {
  name?: string;
}

function findPackageJson(directory: string): string | null {
  let current = directory;
  while (current !== path.dirname(current)) {
    const pkgPath = path.join(current, "package.json");
    if (existsSync(pkgPath)) {
      return pkgPath;
    }
    current = path.dirname(current);
  }
  return null;
}

function findCargoToml(directory: string): string | null {
  let current = directory;
  while (current !== path.dirname(current)) {
    const cargoPath = path.join(current, "Cargo.toml");
    if (existsSync(cargoPath)) {
      return cargoPath;
    }
    current = path.dirname(current);
  }
  return null;
}

function findGoMod(directory: string): string | null {
  let current = directory;
  while (current !== path.dirname(current)) {
    const goModPath = path.join(current, "go.mod");
    if (existsSync(goModPath)) {
      return goModPath;
    }
    current = path.dirname(current);
  }
  return null;
}

function isPackageJson(data: unknown): data is PackageJson {
  return typeof data === "object" && data !== null;
}

function detectPackageManagerType(rootDir: string): WorkspaceInfo["type"] {
  if (existsSync(path.join(rootDir, "pnpm-workspace.yaml"))) return "pnpm";
  if (existsSync(path.join(rootDir, "bun.lockb"))) return "bun";
  if (existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  return "npm";
}

function detectRootPackageType(pkgDir: string): WorkspaceInfo["type"] {
  if (existsSync(path.join(pkgDir, "bun.lockb"))) return "bun";
  if (existsSync(path.join(pkgDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(pkgDir, "yarn.lock"))) return "yarn";
  return "npm";
}

function tryParsePackageJson(directory: string, gitRoot: string | null): WorkspaceInfo | null {
  const pkgPath = findPackageJson(directory);
  if (!pkgPath) return null;

  try {
    const pkgData: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (!isPackageJson(pkgData)) return null;

    const pkg = pkgData;
    const pkgDir = path.dirname(pkgPath);

    // If we're in a subdirectory of the git root, this might be a workspace package
    if (gitRoot !== null && pkgDir !== gitRoot && pkgDir.startsWith(gitRoot)) {
      const workspaceName = pkg.name ?? path.basename(pkgDir);
      return {
        name: workspaceName,
        root: pkgDir,
        type: detectPackageManagerType(gitRoot),
      };
    }

    // Root package
    if (pkg.name !== undefined) {
      return {
        name: pkg.name,
        root: pkgDir,
        type: detectRootPackageType(pkgDir),
      };
    }
  } catch {
    // Invalid package.json
  }

  return null;
}

function tryParseCargoToml(directory: string): WorkspaceInfo | null {
  const cargoPath = findCargoToml(directory);
  if (!cargoPath) return null;

  try {
    const content = readFileSync(cargoPath, "utf8");
    const nameMatch = /^[ \t]*name[ \t]*=[ \t]*"([^"]+)"/m.exec(content);
    if (nameMatch?.[1] !== undefined) {
      return {
        name: nameMatch[1],
        root: path.dirname(cargoPath),
        type: "cargo",
      };
    }
  } catch {
    // Invalid Cargo.toml
  }

  return null;
}

function tryParseGoMod(directory: string): WorkspaceInfo | null {
  const goModPath = findGoMod(directory);
  if (!goModPath) return null;

  try {
    const content = readFileSync(goModPath, "utf8");
    const moduleMatch = /^module\s+(\S+)/m.exec(content);
    if (moduleMatch?.[1] !== undefined) {
      return {
        name: moduleMatch[1],
        root: path.dirname(goModPath),
        type: "go",
      };
    }
  } catch {
    // Invalid go.mod
  }

  return null;
}

export function getWorkspaceInfo(directory: string, gitRoot: string | null): WorkspaceInfo | null {
  const pkgInfo = tryParsePackageJson(directory, gitRoot);
  if (pkgInfo !== null) return pkgInfo;

  const cargoInfo = tryParseCargoToml(directory);
  if (cargoInfo !== null) return cargoInfo;

  const goInfo = tryParseGoMod(directory);
  if (goInfo !== null) return goInfo;

  return null;
}
