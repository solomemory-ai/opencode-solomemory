import { existsSync } from "node:fs";
import path from "node:path";

import type { Framework } from "@vercel/frameworks";
import { frameworks } from "@vercel/frameworks";
import {
  detectFrameworks as vercelDetectFrameworks,
  LocalFileSystemDetector,
} from "@vercel/fs-detectors";

import { execGitCommand } from "./git.js";

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/** Map of file extensions to language names */
const EXTENSION_LANGUAGE_MAP: ReadonlyMap<string, string> = new Map([
  // JavaScript / TypeScript
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".mts", "typescript"],
  [".cts", "typescript"],
  [".js", "javascript"],
  [".jsx", "javascript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  // Web markup & styling
  [".html", "html"],
  [".htm", "html"],
  [".css", "css"],
  [".scss", "scss"],
  [".sass", "sass"],
  [".less", "less"],
  // Frontend frameworks (component files)
  [".vue", "vue"],
  [".svelte", "svelte"],
  [".astro", "astro"],
  // Systems / compiled
  [".rs", "rust"],
  [".go", "go"],
  [".c", "c"],
  [".h", "c"],
  [".cpp", "cpp"],
  [".cc", "cpp"],
  [".cxx", "cpp"],
  [".hpp", "cpp"],
  [".zig", "zig"],
  [".nim", "nim"],
  [".cr", "crystal"],
  [".v", "vlang"],
  // JVM
  [".java", "java"],
  [".kt", "kotlin"],
  [".kts", "kotlin"],
  [".scala", "scala"],
  [".clj", "clojure"],
  [".cljs", "clojure"],
  [".cljc", "clojure"],
  [".groovy", "groovy"],
  [".gradle", "groovy"],
  // .NET
  [".cs", "csharp"],
  [".fs", "fsharp"],
  [".fsx", "fsharp"],
  [".vb", "visualbasic"],
  // Scripting
  [".py", "python"],
  [".pyi", "python"],
  [".rb", "ruby"],
  [".php", "php"],
  [".pl", "perl"],
  [".pm", "perl"],
  [".lua", "lua"],
  [".sh", "shell"],
  [".bash", "shell"],
  [".zsh", "shell"],
  [".fish", "shell"],
  [".ps1", "powershell"],
  [".psm1", "powershell"],
  // Apple
  [".swift", "swift"],
  [".m", "objectivec"],
  [".mm", "objectivec"],
  // Functional
  [".ex", "elixir"],
  [".exs", "elixir"],
  [".erl", "erlang"],
  [".hrl", "erlang"],
  [".hs", "haskell"],
  [".lhs", "haskell"],
  [".ml", "ocaml"],
  [".mli", "ocaml"],
  [".gleam", "gleam"],
  [".elm", "elm"],
  // Data science / math
  [".r", "r"],
  [".R", "r"],
  [".jl", "julia"],
  // Mobile
  [".dart", "dart"],
  // Data & query
  [".sql", "sql"],
  [".graphql", "graphql"],
  [".gql", "graphql"],
  [".proto", "protobuf"],
  // Infrastructure
  [".tf", "terraform"],
  [".hcl", "hcl"],
  [".nix", "nix"],
  [".dhall", "dhall"],
  // Markup & docs
  [".md", "markdown"],
  [".mdx", "mdx"],
  [".tex", "latex"],
  [".typ", "typst"],
  // Blockchain
  [".sol", "solidity"],
  [".move", "move"],
  // Config / data (low-weight, but useful for project characterization)
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".toml", "toml"],
  [".xml", "xml"],
  [".json", "json"],
  [".jsonc", "json"],
]);

/** Detect languages via `git ls-files` + extension counting. Fast, respects .gitignore. */
function detectLanguagesFromGit(directory: string): string[] {
  const output = execGitCommand("git ls-files", directory);
  if (!output) return [];

  const counts = new Map<string, number>();
  for (const file of output.split("\n")) {
    const ext = path.extname(file).toLowerCase();
    const lang = EXTENSION_LANGUAGE_MAP.get(ext);
    if (lang !== undefined) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }

  return [...counts.entries()].toSorted(([, a], [, b]) => b - a).map(([lang]) => lang);
}

/** Config-file heuristic fallback when not in a git repo */
function detectLanguagesFromFiles(directory: string): string[] {
  const indicators: readonly (readonly [string, string])[] = [
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

  const found: string[] = [];
  for (const [file, lang] of indicators) {
    if (existsSync(path.join(directory, file)) && !found.includes(lang)) {
      found.push(lang);
    }
  }
  return found;
}

/**
 * Detect all programming languages in a project directory, ordered by file count.
 * Uses `git ls-files` + extension mapping (fast, respects .gitignore).
 * Falls back to config-file heuristics if not in a git repo.
 */
export function detectLanguages(directory: string): string[] {
  const gitResult = detectLanguagesFromGit(directory);
  if (gitResult.length > 0) return gitResult;
  return detectLanguagesFromFiles(directory);
}

/**
 * Detect the primary programming language of a project directory.
 * Convenience wrapper over detectLanguages() for single-value consumers.
 */
export function detectLanguage(directory: string): string | null {
  const languages = detectLanguages(directory);
  return languages[0] ?? null;
}

// ============================================================================
// PACKAGE MANAGER DETECTION
// ============================================================================

/** Lockfile-based detection (high confidence, checked first) */
const LOCKFILE_MANAGERS: readonly (readonly [string, string])[] = [
  // JavaScript/TypeScript
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["deno.lock", "deno"],
  // Rust
  ["Cargo.lock", "cargo"],
  // Go
  ["go.sum", "go"],
  // Python
  ["uv.lock", "uv"],
  ["poetry.lock", "poetry"],
  ["Pipfile.lock", "pipenv"],
  ["pdm.lock", "pdm"],
  ["pixi.lock", "pixi"],
  ["conda-lock.yml", "conda"],
  // Ruby
  ["Gemfile.lock", "bundler"],
  // PHP
  ["composer.lock", "composer"],
  // Java/Kotlin
  ["gradle.lockfile", "gradle"],
  // C#/.NET
  ["packages.lock.json", "nuget"],
  ["paket.lock", "paket"],
  // Swift/iOS
  ["Package.resolved", "swift-pm"],
  ["Podfile.lock", "cocoapods"],
  ["Cartfile.resolved", "carthage"],
  // Dart/Flutter
  ["pubspec.lock", "pub"],
  // Elixir
  ["mix.lock", "mix"],
  // Erlang
  ["rebar.lock", "rebar3"],
  // Haskell
  ["cabal.project.freeze", "cabal"],
  ["stack.yaml.lock", "stack"],
  // C/C++
  ["conan.lock", "conan"],
  // Nix
  ["flake.lock", "nix"],
  // Terraform
  [".terraform.lock.hcl", "terraform"],
  // R
  ["renv.lock", "renv"],
  // Julia
  ["Manifest.toml", "julia-pkg"],
  // Crystal
  ["shard.lock", "shards"],
  // Gleam
  ["manifest.toml", "gleam"],
  // D
  ["dub.selections.json", "dub"],
  // Nim
  ["nimble.lock", "nimble"],
  // Perl
  ["cpanfile.snapshot", "carton"],
  // Bazel
  ["MODULE.bazel.lock", "bazel"],
  // OCaml
  ["opam.locked", "opam"],
  // macOS
  ["Brewfile.lock.json", "homebrew"],
];

/** Manifest-based fallback (lower confidence, checked when no lockfile found) */
const MANIFEST_MANAGERS: readonly (readonly [string, string])[] = [
  ["pom.xml", "maven"],
  ["build.gradle", "gradle"],
  ["build.gradle.kts", "gradle"],
  ["build.sbt", "sbt"],
  ["project.clj", "leiningen"],
  ["requirements.txt", "pip"],
  ["deps.edn", "clojure-deps"],
  ["vcpkg.json", "vcpkg"],
];

/**
 * Detect all package managers used in a project directory.
 * Checks lockfiles first (high confidence), then manifests (lower confidence).
 * Returns deduplicated list preserving detection order.
 */
export function detectPackageManagers(directory: string): string[] {
  const found = new Set<string>();

  for (const [file, pm] of LOCKFILE_MANAGERS) {
    if (existsSync(path.join(directory, file))) {
      found.add(pm);
    }
  }

  for (const [file, pm] of MANIFEST_MANAGERS) {
    if (existsSync(path.join(directory, file))) {
      found.add(pm);
    }
  }

  return [...found];
}

// ============================================================================
// FRAMEWORK DETECTION
// ============================================================================

/**
 * Detect all web frameworks used in a project directory.
 * Uses @vercel/fs-detectors (68 frameworks, production-tested by Vercel).
 * Falls back to config-file heuristics for frameworks Vercel doesn't cover
 * (Django via manage.py, Laravel via artisan).
 */
export async function detectFrameworks(directory: string): Promise<string[]> {
  try {
    const fs = new LocalFileSystemDetector(directory);
    // @vercel/frameworks exports deeply readonly tuples but @vercel/fs-detectors
    // expects Framework[] — upstream type mismatch between Vercel's own packages
    const matched = await vercelDetectFrameworks({
      fs,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      frameworkList: frameworks as unknown as Framework[],
    });
    if (matched.length > 0) {
      return matched.map((fw) => fw.slug).filter((s): s is string => s !== null);
    }
  } catch {
    // Vercel detector may fail on some directories — fall through to heuristic
  }

  const fallback = detectFrameworkFallback(directory);
  return fallback ? [fallback] : [];
}

/** Heuristic fallback for frameworks not covered by @vercel/fs-detectors */
function detectFrameworkFallback(directory: string): string | null {
  const fallbacks: [string, string][] = [
    ["manage.py", "django"],
    ["artisan", "laravel"],
  ];

  for (const [file, fw] of fallbacks) {
    if (existsSync(path.join(directory, file))) return fw;
  }
  return null;
}
