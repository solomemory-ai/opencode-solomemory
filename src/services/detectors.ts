import { existsSync } from "node:fs";
import path from "node:path";

import type { Framework } from "@vercel/frameworks";
import { frameworks } from "@vercel/frameworks";
import {
  detectFrameworks as vercelDetectFrameworks,
  LocalFileSystemDetector,
} from "@vercel/fs-detectors";
import linguist from "linguist-js";

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect all programming languages in a project directory, ordered by byte count.
 * Uses linguist-js (GitHub Linguist data, 600+ languages) with quick mode
 * for performance. Falls back to config-file heuristics if linguist fails.
 */
export async function detectLanguages(directory: string): Promise<string[]> {
  try {
    const result = await linguist(directory, {
      quick: true,
      keepVendored: false,
      categories: ["programming"],
    });

    const sorted = Object.entries(result.languages.results)
      .filter(([, data]) => data.type === "programming")
      .toSorted(([, a], [, b]) => b.bytes - a.bytes);

    if (sorted.length > 0) {
      return sorted.map(([name]) => name.toLowerCase());
    }
  } catch {
    // linguist-js may fail on some directories — fall through to heuristic
  }

  const fallback = detectLanguageFallback(directory);
  return fallback ? [fallback] : [];
}

/**
 * Detect the primary programming language of a project directory.
 * Convenience wrapper over detectLanguages() for single-value consumers.
 */
export async function detectLanguage(directory: string): Promise<string | null> {
  const languages = await detectLanguages(directory);
  return languages[0] ?? null;
}

/** Fast config-file heuristic fallback for language detection */
function detectLanguageFallback(directory: string): string | null {
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
