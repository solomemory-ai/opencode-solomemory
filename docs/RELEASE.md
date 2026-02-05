# Release

## Dev Versions (automatic)

Every push to `v1.0` auto-publishes a dev version to npm:

```
1.0.0-dev.a1b2c3d  →  npm install opencode-solomemory@dev
```

Runs full `bun run check` before publishing. Skipped for tag pushes.

## Stable Release

```bash
./scripts/release.sh patch   # 1.0.0 → 1.0.1
./scripts/release.sh minor   # 1.0.0 → 1.1.0
./scripts/release.sh major   # 1.0.0 → 2.0.0

git push && git push --tags
```

1. Script validates: clean repo, correct branch, build passes
2. Bumps version in `package.json`, commits, tags
3. Push triggers GitHub Actions → publishes to npm (`latest` tag)

## Setup

1. On [npmjs.com](https://www.npmjs.com), go to package settings → "Publishing access"
2. Add trusted publisher: repo `solomemory-ai/opencode-solomemory`, workflow `publish.yml`
3. Single workflow handles both dev and release via OIDC — no `NPM_TOKEN` needed

## Requirements

- On `v1.0` or `main` branch
- No uncommitted changes
- `jq` and `bun` installed
