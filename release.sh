#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Error: Version number is required"
  echo "Usage: ./release.sh <version> [commit message]"
  echo "Example: ./release.sh 1.2.1"
  echo "Example: ./release.sh 1.2.1 \"chore: release 1.2.1\""
  exit 1
fi

VERSION=$1
COMMIT_MSG=${2:-"chore: bump version to $VERSION"}

if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo "Error: Version must be in format x.y.z or x.y.z-tag"
  exit 1
fi

echo "Releasing @apito-io/js-admin-sdk version: $VERSION"
echo "Commit message: $COMMIT_MSG"
echo ""

echo "Running tests..."
npm test

echo "Building package..."
npm run build

echo "Updating package version..."
npm version "$VERSION" --no-git-tag-version

SYNC_VER="$VERSION" node -e "const fs=require('fs');const v=process.env.SYNC_VER;const p='src/version.ts';let s=fs.readFileSync(p,'utf8');s=s.replace(/export const Version = '[^']*'/,\"export const Version = '\"+v+\"'\");fs.writeFileSync(p,s);"
echo "Synced src/version.ts to $VERSION"

echo "Committing changes..."
git add package.json package-lock.json src/version.ts CHANGELOG.md 2>/dev/null || true
git add -u
git commit -m "$COMMIT_MSG" || true

echo "Creating and pushing tag v$VERSION..."
git tag "v$VERSION"
git push && git push --tags

echo ""
echo "Released version $VERSION. GitHub Actions will publish to npm if NPM_TOKEN is configured."
echo "Package: @apito-io/js-admin-sdk@$VERSION"
