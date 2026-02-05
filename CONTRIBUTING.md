# Contributing to opencode-solomemory

Thanks for your interest in contributing! This guide covers everything you need to get started.

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

## Development

```bash
bun run build       # Build plugin + CLI
bun run typecheck   # Type-check without emitting
bun dev             # Watch mode (tsc --watch)
```

The project has two build targets:

- `src/index.ts` — the OpenCode plugin (loaded by OpenCode at runtime)
- `src/cli.ts` — the CLI binary (`bunx opencode-solomemory install`, etc.)

### Project structure

```
src/
├── index.ts               # Plugin entry: hooks + wiring
├── tools.ts               # Tool handler (search, profile, list, help)
├── sync.ts                # Session sync logic
├── config.ts              # Config resolution (env > jsonc > credentials > defaults)
├── cli.ts                 # CLI entry point
├── cli/
│   ├── index.ts           # CLI argument parsing + dispatch
│   ├── install.ts         # Install command
│   ├── auth.ts            # Login/logout/whoami commands
│   ├── templates.ts       # Config templates + string constants
│   └── prompt.ts          # Interactive prompts
├── types/
│   └── index.ts           # Shared interfaces
└── services/
    ├── client.ts          # API communication
    ├── client-types.ts    # API response types + type guards
    ├── context.ts         # Memory → prompt formatting
    ├── messages.ts        # Message extraction + filtering
    ├── tags.ts            # Container tag generation
    ├── workspace.ts       # Git/workspace info detection
    ├── privacy.ts         # PII/secret redaction
    ├── auth.ts            # Credential management
    ├── logger.ts          # File logger
    └── jsonc.ts           # JSONC parser
```

### Testing

There is no automated test suite yet. Contributions adding tests are welcome.

For manual testing, build the plugin and point OpenCode at your local build:

```bash
bun run build
# Then configure OpenCode to load the plugin from ./dist/index.js
```

## Making changes

1. Fork the repo and create a branch from `v1.0` (or `main`).
2. Make your changes.
3. Run `bun run lint` — it must pass with no errors.
4. Run `bun run format:check` — it must pass.
5. Run `bun run typecheck` — it must pass with no errors.
6. Run `bun run build` — it must succeed.
7. Test manually with OpenCode if your change affects runtime behavior.
8. Open a pull request.

### Code style

This project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for formatting. Both are enforced in CI.

```bash
bun run lint          # Check for lint errors
bun run lint:fix      # Auto-fix what ESLint can
bun run format        # Format all files with Prettier
bun run format:check  # Check formatting without writing
```

**Rules enforced by the linter:**

- **TypeScript strict** — no `any`, no unsafe assignments/calls/returns, no floating promises, no type assertions (`as X` is banned — use type guards instead)
- **Strict boolean expressions** — no truthy checks on non-booleans; use explicit comparisons (`!== undefined`, `.length > 0`)
- **Complexity limits** — cyclomatic complexity ≤10, cognitive complexity ≤10, max nesting depth ≤3, max function params ≤3
- **Size limits** — max 300 lines per file, max 50 lines per function (blank lines and comments excluded)
- **Import organization** — imports are auto-sorted; run `bun run lint:fix` to reorder
- **Modern JS** — nullish coalescing (`??`) over logical OR (`||`), `for...of` over `.forEach()`, `Number.isNaN()` over `isNaN()`
- **No duplicates** — no identical functions, no repeated string literals

**Additional conventions:**

- Use the `Result<T, E>` pattern (discriminated unions) for fallible operations.
- Keep imports explicit (`verbatimModuleSyntax` is enabled).
- Use `import type` for type-only imports.
- Use default imports for Node built-ins (`import path from "node:path"`, not named imports).
- No `eslint-disable` comments unless suppressing a verified false positive.

### Commit messages

Write clear, concise commit messages. No enforced format — just be descriptive.

## Reporting bugs

Open an issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Bun version, OpenCode version)

## Suggesting features

Open an issue describing the use case and why it would be useful. Discussion before implementation saves everyone time.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE) license.
