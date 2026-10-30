#!/bin/bash
# Scrapes bluegolf and pushes docs/data.json to GitHub. Run by launchd every 15 minutes.
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/.."

echo "=== $(date) ==="
git pull -q --rebase origin main || true
node scraper/scrape.mjs
git add docs/data.json
if git diff --cached --quiet; then
  echo "No changes"
else
  git commit -q -m "data: $(date -u +'%Y-%m-%d %H:%M UTC')"
  git push -q origin main
  echo "Pushed"
fi
