# Q-School Finder

Search every PGA TOUR Q-School leaderboard at once. Find any player across all sites, see whether they're inside the number, and follow them stage to stage.

Unofficial. Scores come from the official leaderboards on [pgatq.bluegolf.com](https://pgatq.bluegolf.com/bluegolf/pgatq26/schedule/index.htm?display=date); every row links back to the official page.

## How it works

- `docs/` is the site, served by GitHub Pages. It is one static page that reads `docs/data.json`.
- `scraper/scrape.mjs` reads the bluegolf schedule, then every site's leaderboard, and writes `docs/data.json`.
- `scripts/update-local.sh` runs the scraper and pushes `data.json` when it changed. It has to run from a home internet connection: bluegolf sits behind AWS WAF, which challenges cloud IPs (GitHub Actions, VPSes) and never lets them through. Pages redeploys on every push.
- `scripts/install-mac.sh` installs a launchd job that runs the updater every 15 minutes on a Mac.

## Setup (one time)

GitHub: push the repo (public), then **Settings → Pages**: deploy from branch `main`, folder `/docs`. The site is at `https://<user>.github.io/<repo>/`.

On the Mac that will run the updater (plugged in, lid open, on home Wi-Fi). Works on macOS 12 Monterey and later, so a 2016-era MacBook is fine; Playwright is pinned to 1.48.2 for that reason, so don't bump it.

1. Install Node 22 LTS from https://nodejs.org (the macOS installer; Node 22 is the last line that runs on Monterey).
2. Install GitHub CLI from https://github.com/cli/cli/releases (the `gh_*_macOS_amd64.pkg` file for an Intel Mac).
3. In Terminal:

```
gh auth login            # choose GitHub.com, HTTPS, log in with browser

# The repo
cd ~ && gh repo clone <user>/<repo> qschool-finder && cd qschool-finder
npm ci --prefix scraper
cd scraper && npx playwright install chromium && cd ..

# Test one scrape (should end with "wrote ... 28 sites, N players")
node scraper/scrape.mjs

# Schedule it
./scripts/install-mac.sh
```

Keep the Mac from sleeping: System Settings → Battery (or Energy Saver) → "Prevent automatic sleeping when the display is off" on, and leave the lid open (a MacBook with the lid closed sleeps unless an external display is attached). The screen itself can turn off.

Check it's working: `tail -f ~/qschool-finder/update.log`, or look for commits by the script on GitHub.

## Local

```
npm ci --prefix scraper
npm test --prefix scraper      # parses a saved fixture, no network
node scraper/scrape.mjs        # real scrape → docs/data.json
cd docs && python3 -m http.server 8000
```

## Next season

Change `QS_SEASON` (defaults to `pgatq26`) in the workflow or environment to the new bluegolf season code, and update the links in `docs/index.html`.

## Notes

- GitHub's scheduler can run several minutes late when busy; expect scores to trail the official site by 15–45 minutes.
- If bluegolf changes its page layout, the scraper keeps the last good data for any site that parses to zero players and logs a warning, so the site degrades to stale rather than blank.
- Scheduled workflows pause after 60 days without commits to the repo; the bot's own data commits keep it active during the season.
