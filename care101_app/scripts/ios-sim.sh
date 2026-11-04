#!/usr/bin/env bash
# Build the app (with the QueueWidget extension) for the iOS Simulator and
# install + launch it on one or more simulators.
#
#   scripts/ios-sim.sh "iPhone 17 Pro" "iPhone 18 Pro"
#   CONFIGURATION=Debug scripts/ios-sim.sh "iPhone 17 Pro"   # Debug needs `npx expo start`
#   SKIP_BUILD=1 scripts/ios-sim.sh "iPhone 18 Pro"          # reinstall the last build
#
# Uses xcodebuild + simctl directly (same as .github/workflows/build-ios-simulator.yml),
# so it works even when `expo run:ios` misdetects simulators on newer Xcode versions.
set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}" LC_ALL="${LC_ALL:-en_US.UTF-8}"

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$APP_DIR/ios"
SCHEME="carelinkdoctorapp"
BUNDLE_ID="com.damiduuofc.carelinkdoctorapp"
CONFIGURATION="${CONFIGURATION:-Release}"
DERIVED_DATA="$IOS_DIR/build/DerivedData"
APP_PATH="$DERIVED_DATA/Build/Products/${CONFIGURATION}-iphonesimulator/$SCHEME.app"

if [ "$#" -eq 0 ]; then
  set -- "iPhone 17 Pro"
fi

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  if [ ! -d "$IOS_DIR/Pods" ] || [ "$IOS_DIR/Podfile" -nt "$IOS_DIR/Pods/Manifest.lock" ]; then
    echo "› Installing CocoaPods"
    (cd "$IOS_DIR" && pod install)
  fi

  echo "› Building $SCHEME ($CONFIGURATION, iOS Simulator)"
  LOG="$IOS_DIR/build/xcodebuild.log"
  mkdir -p "$IOS_DIR/build"
  if ! xcodebuild \
      -workspace "$IOS_DIR/$SCHEME.xcworkspace" \
      -scheme "$SCHEME" \
      -configuration "$CONFIGURATION" \
      -sdk iphonesimulator \
      -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath "$DERIVED_DATA" \
      CODE_SIGN_IDENTITY="-" \
      DEVELOPMENT_TEAM="" \
      build > "$LOG" 2>&1; then
    grep -E "error:" "$LOG" | sort -u | head -40 || true
    echo "✖ Build failed. Full log: $LOG"
    exit 1
  fi
  echo "✔ Build succeeded"
fi

if [ ! -d "$APP_PATH/PlugIns/QueueWidget.appex" ]; then
  echo "✖ $APP_PATH is missing QueueWidget.appex"
  exit 1
fi

open -a Simulator 2>/dev/null || open "$(xcode-select -p)/Applications/Simulator.app" 2>/dev/null || true

for DEVICE in "$@"; do
  echo "› $DEVICE"
  xcrun simctl boot "$DEVICE" 2>/dev/null || true   # already booted is fine
  xcrun simctl bootstatus "$DEVICE" -b > /dev/null
  xcrun simctl install "$DEVICE" "$APP_PATH"
  xcrun simctl launch "$DEVICE" "$BUNDLE_ID" > /dev/null
  echo "  ✔ installed and launched"
done

echo "Add the widget: long-press the home screen → + → search \"carelink\" → Live Queue."
