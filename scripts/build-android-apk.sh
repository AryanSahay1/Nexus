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

# AGP 8.x's JdkImageTransform requires JDK 17 specifically. JDK 21
# fails on react-native-app-auth's compileDebugJavaWithJavac. JDK 11
# is too old for AGP 8. Force 17 if present; fall back to whatever
# `java -version` resolves to (with a warning if it looks wrong).
JAVA_VERSION="$(java -version 2>&1 | head -1 | awk -F'"' '{print $2}' | cut -d. -f1)"
if [ "$JAVA_VERSION" != "17" ]; then
  for cand in /usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/jvm/temurin-17-jdk-amd64 /opt/jdk-17 \
              /Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home; do
    if [ -x "$cand/bin/java" ]; then
      export JAVA_HOME="$cand"
      export PATH="$JAVA_HOME/bin:$PATH"
      echo "==> Using JDK 17 at $JAVA_HOME"
      break
    fi
  done
  CURRENT_VERSION="$(java -version 2>&1 | head -1 | awk -F'"' '{print $2}' | cut -d. -f1)"
  if [ "$CURRENT_VERSION" != "17" ]; then
    echo "WARN: building with JDK $CURRENT_VERSION. AGP 8.x is best-tested on JDK 17;"
    echo "      JDK 21 fails on react-native-app-auth's compileDebugJavaWithJavac."
  fi
fi

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
