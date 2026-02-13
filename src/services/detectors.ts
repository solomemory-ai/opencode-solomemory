import { existsSync } from "node:fs";
import path from "node:path";

import type { Framework } from "@vercel/frameworks";
import { frameworks } from "@vercel/frameworks";
import {
  detectFramework as vercelDetectFramework,
  LocalFileSystemDetector,
} from "@vercel/fs-detectors";
import linguist from "linguist-js";

type DeepMutable<T> = { -readonly [P in keyof T]: DeepMutable<T[P]> };

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect the primary programming language of a project directory.
 * Uses linguist-js (GitHub Linguist data, 600+ languages) with quick mode
 * for performance. Falls back to config-file heuristics if linguist fails.
 */
export async function detectLanguage(directory: string): Promise<string | null> {
  try {
    const result = await linguist(directory, {
      quick: true,
      keepVendored: false,
      categories: ["programming"],
    });

    // Find the language with the most bytes
    const sorted = Object.entries(result.languages.results)
      .filter(([, data]) => data.type === "programming")
      .toSorted(([, a], [, b]) => b.bytes - a.bytes);

    const primary = sorted[0];
    if (primary) {
      return primary[0].toLowerCase();
    }
  } catch {
    // linguist-js may fail on some directories — fall through to heuristic
  }

  return detectLanguageFallback(directory);
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

export function detectPackageManager(directory: string): string | null {
  for (const [file, pm] of LOCKFILE_MANAGERS) {
    if (existsSync(path.join(directory, file))) {
      return pm;
    }
  }

  for (const [file, pm] of MANIFEST_MANAGERS) {
    if (existsSync(path.join(directory, file))) {
      return pm;
    }
  }

  return null;
}

// ============================================================================
// FRAMEWORK DETECTION
// ============================================================================

/**
 * Detect the web framework used in a project directory.
 * Uses @vercel/fs-detectors (68 frameworks, production-tested by Vercel).
 * Falls back to config-file heuristics for frameworks Vercel doesn't cover
 * (Django via manage.py, Laravel via artisan).
 */
export async function detectFramework(directory: string): Promise<string | null> {
  try {
    const fs = new LocalFileSystemDetector(directory);
    // @vercel/frameworks exports deeply readonly tuples but @vercel/fs-detectors
    // expects mutable arrays — upstream type mismatch between Vercel's own packages
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mutableFrameworks = frameworks as unknown as DeepMutable<Framework>[];
    const slug = await vercelDetectFramework({
      fs,
      frameworkList: mutableFrameworks,
    });
    if (slug) return slug;
  } catch {
    // Vercel detector may fail on some directories — fall through to heuristic
  }

  return detectFrameworkFallback(directory);
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
