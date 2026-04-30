#!/usr/bin/env bash
# Build a signed AAB for Play Store internal testing.
#
# Run order assumed:
#   1. npm run cap:add:android         # one-time, creates ./android/
#   2. npm run cap:assets              # generates icons + splash
#   3. npm run android:keystore        # one-time, creates signing key
#   4. npm run android:bundle          # this script
#
# Output: android/app/build/outputs/bundle/release/app-release.aab
# Upload that file to Play Console → Internal testing → Create new release.

set -euo pipefail

if [[ ! -d android ]]; then
  echo "❌ android/ directory not found. Run: npm run cap:add:android"
  exit 1
fi

if [[ ! -f android/keystore.properties ]]; then
  echo "❌ android/keystore.properties not found. Run: npm run android:keystore"
  exit 1
fi

# Push any web-side changes into the Android project. Does the right thing
# whether webDir is the static export (we copy it in) or the live URL
# (we update plugin manifests only).
echo "→ Syncing Capacitor web assets into android/"
npx cap sync android

cd android

# Use the gradle wrapper that Capacitor generates. --no-daemon keeps CI
# memory predictable; remove if you want faster local builds.
echo "→ Running Gradle bundleRelease (this can take 2-3 minutes the first time)"
./gradlew --no-daemon bundleRelease

cd ..

OUTPUT="android/app/build/outputs/bundle/release/app-release.aab"
if [[ -f "$OUTPUT" ]]; then
  SIZE=$(du -h "$OUTPUT" | cut -f1)
  echo ""
  echo "✅ Built signed AAB: $OUTPUT ($SIZE)"
  echo ""
  echo "Next steps:"
  echo "  1. Open https://play.google.com/console"
  echo "  2. Internal testing → Create new release"
  echo "  3. Upload $OUTPUT"
  echo "  4. Roll out to your tester list"
  echo ""
else
  echo "❌ Build finished but no AAB was produced. Check Gradle output above."
  exit 1
fi
