# World Pulse

A personal, running picture of what is going on in the world, checked against the sources.

**Open it:** https://howkoz.github.io/world-pulse/

- `World-Pulse.html` is the home page: a realistic globe with a pulse for every running story, the heartbeat
  (how much changed per scan), every story with its full dated history, what is coming up, and the daily editions.
- `World-Desk-<date>.html` is one page per daily scan, built around that day's headline story.
- `timelines/` holds each day's timeline picture.
- `pulse/` holds the data (`pulse-data.json`), the builder that checks it (`build_pulse.py`), the globe
  (`globe.js`) and the coastline outlines (`world-land.js`).

Updated each morning at 6:45 am Eastern and whenever Howard asks. History only grows: new facts are added as
dated entries, nothing old is rewritten. How to update: `pulse/HOW-TO-UPDATE.md`.

Map outlines: Natural Earth, public domain (through the world-atlas package). News summaries link to their sources.
