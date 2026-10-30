// Scrapes every PGA TOUR Q-School leaderboard on pgatq.bluegolf.com into docs/data.json.
// Run: node scraper/scrape.mjs            (writes docs/data.json)
//      node scraper/scrape.mjs --test     (parses the fixture in scraper/test and prints it)
import { JSDOM } from "jsdom";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../docs/data.json");
const SEASON = process.env.QS_SEASON || "pgatq26";
const BASE = `https://pgatq.bluegolf.com/bluegolf/${SEASON}`;
const UA = "QSchoolFinder/1.0 (+https://github.com; unofficial fan tool; low volume)";

const tx = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

async function fetchText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
}

export function parseSchedule(html) {
  const doc = new JSDOM(html).window.document;
  const seen = new Set();
  const events = [];
  for (const r of doc.querySelectorAll("tr")) {
    const a = r.querySelector('a[href*="/event/"]');
    if (!a) continue;
    const m = a.getAttribute("href").match(/event\/(pgatq\d+)\//);
    if (!m || seen.has(m[1])) continue;
    const name = tx(r.querySelector(".summary")) || tx(a);
    if (!/stage|qualifying/i.test(name) || /registration/i.test(name)) continue;
    seen.add(m[1]);
    const dm = tx(r.cells[0]).match(/[A-Z][a-z]{2}\s+\d+(?:\s*-\s*(?:[A-Z][a-z]{2}\s+)?\d+)?/);
    events.push({
      id: m[1],
      name,
      date: dm ? dm[0] : "",
      venue: tx(r.querySelector(".d-sm-block .bg-title-popover")),
      loc: tx(r.querySelector(".d-sm-block .address")),
      hasLeaderboard: !!r.querySelector('a[href*="leaderboard"]'),
    });
  }
  return events;
}

export function parseLeaderboard(html) {
  const doc = new JSDOM(html).window.document;
  const table = [...doc.querySelectorAll("table")].find(
    (t) => t.rows.length > 3 && /pos/i.test(tx(t.rows[0]))
  );
  const players = [];
  if (!table) return { players, title: doc.title };
  let section = "";
  for (const r of [...table.rows].slice(1)) {
    if (r.cells.length < 5) {
      const s = tx(r).replace(/\/\/<!\[CDATA\[[\s\S]*?\/\/\]\]>/g, "").replace(/More\.\.\./, "").trim();
      if (s && !/^full leaderboard$/i.test(s)) section = s;
      continue;
    }
    // Column layout varies by site (flag column, movement column), so read cells by class.
    const nameCell = r.querySelector("td.name");
    if (!nameCell) continue;
    const nameEl = nameCell.querySelector("span.d-none") || nameCell.querySelector("a");
    const href = nameCell.querySelector("a")?.getAttribute("href") || "";
    const cid = (href.match(/contestant\/(\d+)\//) || ["", ""])[1];
    const rnd = r.querySelector('input[name$="_rnd"]')?.value || "";
    const rounds = [...r.querySelectorAll("td.rnd")].map(tx);
    while (rounds.length < 4) rounds.push("");
    players.push({
      pos: tx(r.cells[0]),
      name: tx(nameEl) || tx(nameCell.querySelector("a")) || tx(nameCell),
      sort: nameCell.getAttribute("data-sort-value") || "",
      home: tx(nameCell.querySelector("small")),
      total: tx(nameCell.nextElementSibling),
      thru: tx(r.querySelector("td.thru")).replace(/\s*\*$/, ""),
      today: tx(r.querySelector("td.today")),
      rounds: rounds.slice(0, 4),
      strokes: tx(r.querySelector("td.total-strk")),
      round: rnd,
      section,
      cid,
    });
  }
  return { players, title: doc.title.split("|")[0].trim() };
}

function stageOf(name) {
  if (/pre/i.test(name)) return "Pre-Qualifying";
  if (/first/i.test(name)) return "First Stage";
  if (/second/i.test(name)) return "Second Stage";
  if (/final/i.test(name)) return "Final Stage";
  return "Other";
}

async function main() {
  if (process.argv.includes("--test")) {
    const html = await readFile(path.join(HERE, "test/kansas.html"), "utf8");
    const out = parseLeaderboard(html);
    console.log(JSON.stringify(out, null, 1));
    const ok = out.players.length === 5 && out.players[0].name === "Brendon Jelley" && out.players[0].section.startsWith("IN CONTENTION") && out.players[4].pos === "DQ";
    if (!ok) { console.error("FIXTURE PARSE FAILED"); process.exit(1); }
    console.log("fixture OK");
    return;
  }

  const schedule = parseSchedule(await fetchText(`${BASE}/schedule/index.htm?display=date`));
  if (!schedule.length) throw new Error("Schedule parsed to zero events; page layout may have changed.");
  console.log(`schedule: ${schedule.length} events`);

  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch {}
  const prevById = new Map((previous?.sites || []).map((s) => [s.id, s]));

  const sites = [];
  for (const ev of schedule) {
    const url = `${BASE}/event/${ev.id}/contest/1/leaderboard.htm`;
    let players = [], error = null;
    try {
      ({ players } = parseLeaderboard(await fetchText(url)));
    } catch (e) {
      error = e.message;
    }
    // Never replace a good leaderboard with an empty one from a transient failure.
    const prev = prevById.get(ev.id);
    if ((error || !players.length) && prev?.players?.length) {
      console.warn(`${ev.id} ${ev.name}: ${error || "0 players"} — keeping previous ${prev.players.length}`);
      players = prev.players;
    }
    console.log(`${ev.id.padEnd(10)} ${String(players.length).padStart(3)}  ${ev.name}`);
    sites.push({ id: ev.id, name: ev.name, stage: stageOf(ev.name), date: ev.date, venue: ev.venue, loc: ev.loc, url, players });
    await new Promise((r) => setTimeout(r, 400)); // be polite
  }
  const total = sites.reduce((n, s) => n + s.players.length, 0);
  if (total === 0 && previous) throw new Error("Every leaderboard came back empty; not overwriting data.json.");

  const data = { v: 1, season: SEASON, synced: new Date().toISOString(), sites };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data));
  console.log(`wrote ${OUT}: ${sites.length} sites, ${total} players`);
}

main().catch((e) => { console.error(e); process.exit(1); });
