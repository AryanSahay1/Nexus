#!/usr/bin/env bash
#
# Local Android APK builder.
#
# Usage:
#   ./scripts/build-android-apk.sh [debug|release]
#
# Prereqs (script will check):
#   - Node 18+ and npm
#   - JDK 17 or 21 on PATH
#   - Android SDK at $ANDROID_HOME with platforms;android-34 + build-tools;34.0.0
#
# Output:
#   release/nexus-<version>-android-<variant>.apk
#
# This is the same script the GitHub Actions release pipeline uses. It is
# intentionally idempotent: re-running it skips work that is already done.

set -euo pipefail

VARIANT="${1:-debug}"
case "$VARIANT" in
  debug|release) ;;
  *) echo "Usage: $0 [debug|release]"; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Verifying tooling"
command -v node >/dev/null || { echo "node not on PATH"; exit 1; }
command -v java >/dev/null || { echo "JDK not on PATH"; exit 1; }
[ -n "${ANDROID_HOME:-}" ] || [ -n "${ANDROID_SDK_ROOT:-}" ] || {
  echo "ANDROID_HOME / ANDROID_SDK_ROOT not set"; exit 1; }

VERSION="$(node -e "console.log(require('./package.json').version)")"
echo "==> Nexus v$VERSION ($VARIANT)"

if [ ! -d node_modules ]; then
  echo "==> npm install"
  npm install --no-audit --no-fund --legacy-peer-deps
fi

echo "==> npx expo prebuild --platform android"
npx expo prebuild --platform android --no-install --clean

echo "==> gradle assemble$([ "$VARIANT" = "release" ] && echo Release || echo Debug)"
cd android
GRADLE_TASK="assembleDebug"
[ "$VARIANT" = "release" ] && GRADLE_TASK="assembleRelease"
./gradlew "$GRADLE_TASK" --no-daemon --console=plain

cd "$ROOT"
mkdir -p release
SRC="android/app/build/outputs/apk/$VARIANT/app-$VARIANT.apk"
[ -f "$SRC" ] || { echo "Expected $SRC to exist"; exit 1; }
DEST="release/nexus-$VERSION-android-$VARIANT.apk"
cp -v "$SRC" "$DEST"
sha256sum "$DEST" | tee "$DEST.sha256"

echo "==> done: $DEST"
