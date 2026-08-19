SharksVsDolphins
=====================
Play it live: https://gigglesquid19.github.io/Agent-based-Model-main/

SharksVsDolphins started life as a Python agent-based model of deer and wolf
population dynamics, and has since been rebuilt as a free browser game. No
installation, no app store, works on desktop and mobile.

Contents
-------------------
- README
- License File
- index.html (the game: markup, styling and all game logic in one file)
- manifest.json (PWA metadata / home screen icon config)
- icon.svg (app icon)
- Agentbasedmodel.py (original Python simulation, kept for reference)
- agentframework.py (original Python Deer/Wolf classes, kept for reference)

Software Outline
--------------------
SharksVsDolphins is a browser-based survival and strategy game built with
plain HTML, CSS and JavaScript (Canvas 2D). You control a dolphin swimming
in a 2D ocean, avoiding sharks, growing your pod, and eventually turning the
tables to hunt the sharks as a group. It runs entirely client-side, so it can
be hosted for free on GitHub Pages, Netlify or similar static hosts.

How to Play
--------------------
1) Open the game in any modern browser (desktop or mobile).
2) Set your starting options: number of sharks, shark speed, and game speed.
3) Click Start.
4) Control your dolphin with the arrow keys / WASD on desktop, or the
   on-screen D-pad on touch devices. Use the Fullscreen button on mobile for
   a bigger play area.
5) Survive, grow your pod, and try to reach 5 dolphins to unlock School mode.

Game Features
--------------------
- **Survival**: one shark touch ends the game (unless you're invulnerable).
- **Pod growth**: a second dolphin spawns in a safe corner after 60 seconds.
  Swim close to any non-player dolphin to reproduce and grow the pod, up to
  5 dolphins total.
- **Magic Shrimp**: a bonus item appears on the board after 2 minutes.
  - Player dolphin: 30 seconds of double speed.
  - Another dolphin: 30 seconds of invulnerability to sharks.
  - A shark: grows 5x larger and gains a 25% speed boost, permanently.
- **New dolphin protection**: every dolphin that spawns (from the 60 second
  timer or from reproduction) starts with 30 seconds of shark invulnerability.
- **School mode**: once you have 5 dolphins, the School button activates.
  Clicking it flocks the pod around the player in formation. In School mode,
  touching a shark destroys it instead of ending the game. Clear every shark
  to win.
- **Undersea visuals**: layered drifting wave outlines, rising bubbles, and a
  deep-ocean gradient background behind a glass-panel UI.
- **Mobile-first controls**: on-screen D-pad, large touch targets, and a
  fullscreen mode for phones and tablets.

How to Host It Yourself
--------------------
1) Fork or download this repository.
2) Enable GitHub Pages on the `main` branch (root folder) in repo Settings.
3) GitHub will publish `index.html` at your Pages URL automatically.
4) Any push to `main` updates the live game after the Pages build finishes.

There is no build step, backend, or database. It is a static site.

Known Issues
---------------------
- Browsers can cache `index.html` aggressively after a GitHub Pages update.
  If changes don't appear, try a hard refresh, an incognito window, or a
  cache-busting query string (e.g. `?v=2`).
- A previous version used a service worker for offline PWA support; this was
  removed because it caused stale caching during active development. It may
  be reintroduced once the game design has stabilised.

Ideas for Further Development
-----------------------------
- Shark AI variety (patrol, ambush, pack hunting).
- Sound effects and background music.
- Persistent high scores using local storage.
- Difficulty levels and a proper win/lose screen with a replay summary.
- Touch swipe controls as an alternative to the D-pad.

Original Python Model
-----------------------------
The original agent-based model (`Agentbasedmodel.py` and
`agentframework.py`) simulated deer and wolf population dynamics using
matplotlib for animation. It is kept in this repository for reference but is
no longer the primary version of this project. See git history for details
on that implementation.

License
---------------------
This project is licensed under the ISC license.

---------------------------------------------------------------------
Originally developed for Programming for Geographic Information Analyses,
University of Leeds. Since evolved into an independent browser game project.
