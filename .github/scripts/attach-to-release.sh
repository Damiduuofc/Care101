#!/usr/bin/env bash
# Usage: attach-to-release.sh <tag> <file>
#
# The repo uses immutable releases: once a release is published, no more
# assets can be added. The Android and iOS workflows finish at different
# times, so each one adds its file to a *draft* release (creating it if
# needed), and whichever finishes last publishes it once both the APK and
# the iOS simulator .app.zip are attached.
#
# Needs GH_TOKEN, GH_REPO and GITHUB_SHA in the environment.
set -euo pipefail

TAG="$1"
FILE="$2"

release_state() {
  gh release view "$TAG" --json isDraft -q '.isDraft' 2>/dev/null || echo missing
}

STATE=$(release_state)

if [ "$STATE" = "missing" ]; then
  echo "Creating draft release $TAG"
  gh release create "$TAG" \
    --draft \
    --title "Release $TAG" \
    --generate-notes \
    --target "$GITHUB_SHA" \
    || true   # the other workflow may have created it at the same moment
  STATE=$(release_state)
fi

if [ "$STATE" = "false" ]; then
  echo "::error::Release $TAG is already published and immutable, so $(basename "$FILE") cannot be added. Push a new tag (for example the next patch version)."
  exit 1
fi
if [ "$STATE" != "true" ]; then
  echo "::error::Could not find or create a draft release for $TAG."
  exit 1
fi

echo "Uploading $(basename "$FILE") to draft $TAG"
gh release upload "$TAG" "$FILE" --clobber

ASSETS=$(gh release view "$TAG" --json assets -q '.assets[].name')
echo "Assets on $TAG:"
echo "$ASSETS"

if echo "$ASSETS" | grep -q '\.apk$' && echo "$ASSETS" | grep -q '\.app\.zip$'; then
  echo "Both Android and iOS builds attached — publishing $TAG"
  gh release edit "$TAG" --draft=false --latest
  echo "### 🚀 Published release \`$TAG\`" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
else
  echo "Waiting for the other platform's build; $TAG stays a draft for now."
  echo "### 📝 Added to draft release \`$TAG\` (waiting for the other platform)" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
fi
