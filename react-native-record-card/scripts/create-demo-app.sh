#!/usr/bin/env bash
# Creates a bare React Native app (no Expo) with the RecordCard example as its
# home screen. Usage: ./scripts/create-demo-app.sh [target-dir]
set -euo pipefail

PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${1:-$PKG_DIR/../RecordCardDemo}"

if [ -e "$APP_DIR" ]; then
  echo "error: $APP_DIR already exists; pass a different directory" >&2
  exit 1
fi

npx --yes @react-native-community/cli@latest init RecordCardDemo \
  --directory "$APP_DIR" \
  --pm npm \
  --skip-git-init \
  --install-pods false

mkdir -p "$APP_DIR/recordcard"
cp -R "$PKG_DIR/src" "$APP_DIR/recordcard/"
sed "s#from '../src'#from './recordcard/src'#" "$PKG_DIR/example/App.tsx" > "$APP_DIR/App.tsx"

cat <<MSG

Demo app ready in $APP_DIR

  cd "$APP_DIR"
  npx react-native run-android                              # Android device or emulator
  (cd ios && bundle install && bundle exec pod install) && npx react-native run-ios   # macOS only
MSG
