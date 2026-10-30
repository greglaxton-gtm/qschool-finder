#!/bin/bash
# One-time setup on a Mac: installs the scheduled updater (every 15 minutes).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"
PLIST="$HOME/Library/LaunchAgents/com.qschool.update.plist"
mkdir -p "$HOME/Library/LaunchAgents"
sed "s|__HOME__/qschool-finder|$REPO|g" scripts/com.qschool.update.plist > "$PLIST"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Installed. It runs now and every 15 minutes. Log: $REPO/update.log"
echo "To stop:  launchctl unload $PLIST"
