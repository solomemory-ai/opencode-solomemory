# Release

## Quick Release

```bash
./scripts/release.sh patch   # 1.0.0 → 1.0.1
./scripts/release.sh minor   # 1.0.0 → 1.1.0  
./scripts/release.sh major   # 1.0.0 → 2.0.0

git push && git push --tags
```

## What Happens

1. Script validates: clean repo, correct branch, build passes
2. Bumps version in `package.json`, commits, tags
3. Push triggers GitHub Actions → publishes to npm

## Requirements

- On `v1.0` or `main` branch
- No uncommitted changes
- `jq` and `bun` installed
- `NPM_TOKEN` secret in GitHub repo settings
