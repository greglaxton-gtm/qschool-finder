# Q-School Finder

Search every PGA TOUR Q-School leaderboard at once. Find any player across all sites, see whether they're inside the number, and follow them stage to stage.

Unofficial. Scores come from the official leaderboards on [pgatq.bluegolf.com](https://pgatq.bluegolf.com/bluegolf/pgatq26/schedule/index.htm?display=date); every row links back to the official page.

## How it works

- `docs/` is the site, served by GitHub Pages. It is one static page that reads `docs/data.json`.
- `scraper/scrape.mjs` reads the bluegolf schedule, then every site's leaderboard, and writes `docs/data.json`.
- `.github/workflows/scrape.yml` runs the scraper every 15 minutes during the day (US Eastern) and hourly overnight, committing `data.json` only when something changed. Pages redeploys automatically.

## Setup (one time)

1. Push this repo to GitHub (public is fine; Actions minutes are free for public repos).
2. **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/docs`.
3. **Settings → Actions → General → Workflow permissions**: "Read and write permissions" (so the job can commit `data.json`).
4. **Actions → Update leaderboards → Run workflow** to do the first scrape. After that it runs on its own.

The site is then at `https://<user>.github.io/<repo>/`. For a custom domain, add it under Settings → Pages.

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
