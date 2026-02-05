#!/bin/bash
#
# Release script for opencode-solomemory
#
# Usage:
#   ./scripts/release.sh [patch|minor|major]
#
# Examples:
#   ./scripts/release.sh patch   # 1.0.0 → 1.0.1
#   ./scripts/release.sh minor   # 1.0.0 → 1.1.0
#   ./scripts/release.sh major   # 1.0.0 → 2.0.0
#
# After running, push to trigger the GitHub Actions release workflow:
#   git push && git push --tags
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() { echo -e "${RED}error:${NC} $1" >&2; exit 1; }
info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

# Parse args
BUMP_TYPE="${1:-patch}"
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "usage: ./scripts/release.sh [patch|minor|major]"
  exit 1
fi

# Pre-flight checks
echo "Running pre-flight checks..."

# Check jq installed
command -v jq >/dev/null 2>&1 || error "jq is required but not installed"
info "jq installed"

# Check bun installed
command -v bun >/dev/null 2>&1 || error "bun is required but not installed"
info "bun installed"

# Check on correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "v1.0" && "$CURRENT_BRANCH" != "main" ]]; then
  error "must be on 'v1.0' or 'main' branch (currently on '$CURRENT_BRANCH')"
fi
info "on branch '$CURRENT_BRANCH'"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  error "uncommitted changes detected. commit or stash them first"
fi
info "working tree clean"

# Check for unpushed commits
if [[ -n $(git log origin/$CURRENT_BRANCH..$CURRENT_BRANCH 2>/dev/null) ]]; then
  warn "unpushed commits detected"
fi

# Run build
echo ""
echo "Building..."
bun run build || error "build failed"
info "build passed"

# Run typecheck
echo ""
echo "Type checking..."
bun run typecheck || error "typecheck failed"
info "typecheck passed"

# Calculate new version
CURRENT_VERSION=$(jq -r .version package.json)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
  major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
  patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
esac

# Show summary and confirm
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Release Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Version: $CURRENT_VERSION → $NEW_VERSION ($BUMP_TYPE)"
echo "  Branch:  $CURRENT_BRANCH"
echo "  Tag:     v$NEW_VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Proceed with release? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
info "updated package.json"

git add package.json
git commit -m "v$NEW_VERSION"
git tag "v$NEW_VERSION"
info "created commit and tag v$NEW_VERSION"

echo ""
echo -e "${GREEN}Release prepared!${NC}"
echo ""
echo "Run this to publish:"
echo "  git push && git push --tags"
