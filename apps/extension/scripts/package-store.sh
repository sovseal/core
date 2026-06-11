#!/bin/bash
# package-store.sh — Creates a clean ZIP for Chrome Web Store submission
# Usage: bash scripts/package-store.sh
# Output: sovseal-extension-v<version>.zip in the project root

set -euo pipefail

EXTENSION_NAME="sovseal-extension"
VERSION=$(node -p "require('./package.json').version")
OUTPUT="${EXTENSION_NAME}-v${VERSION}.zip"
DIST_DIR="dist"

# Ensure dist is present
if [ ! -f "$DIST_DIR/manifest.json" ]; then
  echo "❌ dist/manifest.json not found. Run 'pnpm run build' first."
  exit 1
fi

# Remove any old package
rm -f "$OUTPUT"

# Create ZIP from the dist/ folder only — this is the clean build output
# No dev files, configs, or secrets will be present since they're never in dist/
cd "$DIST_DIR"
zip -r "../$OUTPUT" . \
  -x "*.DS_Store" \
  -x "Thumbs.db" \
  -x "*.map"
cd ..

SIZE=$(du -sh "$OUTPUT" | cut -f1)
FILE_COUNT=$(unzip -l "$OUTPUT" | tail -1 | awk '{print $2}')

echo ""
echo "✅ Packaged: $OUTPUT"
echo "   Size:  $SIZE"
echo "   Files: $FILE_COUNT"
echo ""
echo "Contents:"
unzip -l "$OUTPUT"
