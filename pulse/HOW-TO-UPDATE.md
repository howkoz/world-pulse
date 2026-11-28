# World Pulse: how to update it

Personal-interest site, not work. Updated by the 6:45 am daily scan, or when Howard asks ("update the pulse",
"what happened with X"). Never on any other schedule. Paths below are relative to the repository root.

## Files

| File | What it is | Edit? |
|---|---|---|
| `World-Pulse.html` | The home page: globe, heartbeat, running stories, coming up, editions | Rarely (layout only) |
| `index.html` | Front door for the web address; forwards to `World-Pulse.html` | No |
| `pulse/pulse-data.json` | ALL the content: threads, their dated updates, editions | YES, every update |
| `pulse/build_pulse.py` | Checks the JSON and writes `pulse-data.js` | Run it, do not edit |
| `pulse/pulse-data.js` | Built file the page loads | Never by hand |
| `pulse/globe.js`, `pulse/world-land.js` | The realistic globe and the coastline data | No |
| `World-Desk-<date>.html` | One daily edition per scan, headline story with its own visual | New one each morning |
| `timelines/` | Each day's timeline picture (SVG), copied in from where it is drawn | Add one each morning |
| `Archive.html` | Everything older than a week: archived stories with full history, older editions by week | No (built from the data) |
| `archive/` | Old World Desk pages and timeline pictures, moved there by `pulse/archive_old.py` | No |
| `publish.py` | Builds, safety-checks and pushes to GitHub | Run it to publish |

## The one rule: history only grows

Never rewrite or delete an old update. New facts go in as a NEW entry at the END of the thread's `updates`
list (oldest first). If an old entry turns out wrong, add an entry that says so.

## Adding to `pulse-data.json`

- A changed story: append `{"ed": "<scan date YYYY-MM-DD>", "when": "<when it happened, Eastern>", "tag": "UPDATED", "text": "...", "src": [["Outlet", "https://..."]]}`.
- Nothing new on a story you checked: append a `"NO CHANGE"` entry (keeps the heartbeat honest).
- A single-source claim: tag `"UNPROVEN"` and name the one source in the text.
- An outcome of a planned moment (a `next` time that has passed): tag `"RESULT"`. The home page then shows
  "Result is in" instead of "Time has passed". Then remove `next`, or set the next planned moment.
- A new story: add a thread `{"id", "title", "cat", "status", "place", "lat", "lon", "first", "updates": [...]}`.
  `cat` is one of: space, tech, mil, war, money, health, acc, world. `status`: developing, watching, settled,
  unproven, quiet. `lat`/`lon` place the pulse on the globe (use `null` if there is no place).
- Change `status` when the story changes state (a story with no news for 3 scans becomes `quiet`).
- Add one entry to `editions` per scan: `{"date", "scan": "15 Nov, 6:52 am Eastern", "headline", "links": [[label, relative path]]}`.
  Links are relative to the repository root (`World-Desk-15Nov2026.html`, `timelines/<name>.svg`).
- Set `updated_utc` to the scan time.
- Plain English, short sentences, spell out every acronym the first time, no em or en dashes,
  never state a cause unless an official source states it.

Then run `py pulse/build_pulse.py`. It refuses to build if anything is wrong and says what. Fix and run again.

## The 14 Nov Starship page has a result slot

In `World-Desk-14Nov2026.html` find `var RESULT = null;` and set it once the catch outcome is known from
SpaceX or a major outlet, for example
`var RESULT = { short: 'Caught', text: 'Ship 42 caught by the tower at 4:21 pm Eastern', ok: true, steps: { 6: 'done', 7: 'done', 8: 'done', 9: 'done' } };`
(steps: 6 final check, 7 slow-down burn, 8 re-entry, 9 tower catch; values done or bad).

## Publish

`py publish.py "<one-line summary>" [path to a new timeline SVG ...]` builds the data, copies any timeline
SVGs given into `timelines/`, refuses to publish if it finds a local computer path, a key or token, or an
em or en dash, then commits the site files by name and pushes. The web address updates about a minute later.

## Check before showing Howard

1. `py pulse/build_pulse.py` succeeds.
2. Script syntax: extract the inline `<script>` blocks and run `node --check`.
3. Smoke test with jsdom (`resources: 'usable'` so the pulse scripts load): no script errors, thread cards render.
4. Publish, then open the web address and the local home page.

## The one-week archive (set 28 Nov 2026)

The home page shows only what is current. Everything else moves to `Archive.html` automatically, every time `publish.py` runs:

- **Current week** = the latest scan date and the 6 days before it (7 scans). Older editions are archived.
- **A story is archived** when its last real entry (anything except NO CHANGE) is older than that and it has no `next` moment still ahead. NO CHANGE entries do not keep a story on the home page.
- **A story comes back** to the home page the day it gets a new NEW, UPDATED, UNPROVEN or RESULT entry. Nothing to do by hand.
- **Files move, never get deleted.** `pulse/archive_old.py` moves an archived edition's `World-Desk-*.html` page and its timeline pictures into `archive/` (same layout: `archive/timelines/...`) with `git mv`, fixes the links in and to those pages, and points the edition links in `pulse-data.json` at the new place.
- **Full story pages** (`Story-*.html`) stay in the root while their story is current. Give the thread a `"story": "Story-....html"` field so the card shows a "Full story" button and the page is kept in place.
- `build_pulse.py` marks each thread and edition with `archived` in `pulse-data.js`; `World-Pulse.html` shows the current ones and `Archive.html` shows the rest, grouped by week, with a search box.
