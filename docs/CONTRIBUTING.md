# Contributing to oc-solomemory

## Prerequisites

- [Bun](https://bun.sh/) (latest)
- A [Solo Memory](https://solomemory.com) account and API key
- [OpenCode](https://opencode.ai) installed (for manual testing)

## Setup

```bash
git clone https://github.com/solomemory-ai/opencode-solomemory.git
cd opencode-solomemory
bun install
```

## Making changes

1. Fork the repo and create a branch from `v1.0` (or `main`).
2. Make your changes.
3. Run `bun run check` — this runs lint, formatting, type-checking, and build in one command. It must pass.
4. Test manually with OpenCode if your change affects runtime behavior.
5. Open a pull request.

A pre-commit hook enforces lint and formatting automatically on every commit.

## Code style

This project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for formatting.

```bash
bun run check         # Run everything (lint + format + typecheck + build)
bun run lint          # Check for lint errors
bun run lint:fix      # Auto-fix what ESLint can
bun run format        # Format all files with Prettier
bun run format:check  # Check formatting without writing
```

**Rules enforced by the linter:**

- **TypeScript strict** — no `any`, no unsafe assignments/calls/returns, no floating promises, no type assertions (`as X` is banned — use type guards instead)
- **Strict boolean expressions** — no truthy checks on non-booleans; use explicit comparisons (`!== undefined`, `.length > 0`)
- **Explicit return types** — all named functions must have explicit return type annotations
- **Naming conventions** — `camelCase` for variables/functions, `PascalCase` for types/classes, `UPPER_CASE` for constants
- **Complexity limits** — cyclomatic complexity ≤10, cognitive complexity ≤10, max nesting depth ≤3, max params ≤3, max statements ≤15
- **Size limits** — max 300 lines per file, max 50 lines per function (blank lines and comments excluded)
- **No magic numbers** — use named constants (only -1, 0, 1, 2 are allowed inline)
- **No `else` after `return`** — use early returns instead of `else` blocks
- **Import organization** — imports are auto-sorted; run `bun run lint:fix` to reorder
- **Modern JS** — nullish coalescing (`??`) over logical OR (`||`), `for...of` over `.forEach()`, `Number.isNaN()` over `isNaN()`
- **No duplicates** — no identical functions, no repeated string literals
- **No `eslint-disable`** unless suppressing a verified false positive

**Additional conventions:**

- Use the `Result<T, E>` pattern (discriminated unions) for fallible operations.
- Keep imports explicit (`verbatimModuleSyntax` is enabled).
- Use `import type` for type-only imports.
- Use default imports for Node built-ins (`import path from "node:path"`, not named imports).

## Reporting bugs

Open an issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Bun version, OpenCode version)

## Suggesting features

Open an issue describing the use case and why it would be useful. Discussion before implementation saves everyone time.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](../LICENSE) license.
