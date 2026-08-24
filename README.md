SharksVsDolphins
=====================
SharksVsDolphins started life as a Python agent-based model of deer and wolf
population dynamics, and has since been rebuilt as a browser game. You play
as Echo, a dolphin separated from your pod, trying to survive, regroup, and
eventually turn the tables on the sharks hunting your waters.

The game is built with TypeScript, Vite, and PixiJS (WebGL rendering), and
runs entirely client-side.

Contents
-------------------
- `index.html` - page markup: title screen, narrative screen, settings panel,
  game canvas, on-screen controls, and audio elements.
- `src/main.ts` - entry point: wires up all UI (buttons, D-pad, joystick,
  volume, pause menu, fullscreen) to the `Game` class.
- `src/game.ts` - core game/simulation orchestration: level flow, spawning,
  Hunting Mode, procedural storm/jellyfish events, the matriarch boss, the
  Mega Shrimp upgrade choices, banners, and the render loop.
- `src/entities.ts` - the Dolphin, Shark, MagicShrimp, and Jellyfish classes
  and their movement logic (no Pixi/DOM dependencies).
- `src/scoring.ts` - local top-10 leaderboard persistence (`localStorage`),
  separate boards for Campaign and Endless.
- `src/achievements.ts` - the achievement definitions and unlock/seen
  persistence (`localStorage`).
- `src/tutorialHints.ts` - first-run tooltip seen/unseen persistence
  (`localStorage`).
- `src/utils.ts` / `src/constants.ts` - shared world-space math helpers
  (wrap/clamp/direction) and the SIZE/CANVAS_SIZE constants they use.
- `src/levels.ts` - the ten-level campaign as data (shark composition,
  counts, speed scaling, pod requirements) rather than per-level code.
- `src/sprites.ts` - PixiJS Graphics/texture factories for dolphins, sharks,
  and jellyfish.
- `src/particles.ts` - lightweight pooled particle system (bubbles, wakes,
  hit sparks, sparkles).
- `src/sfx.ts` - procedurally synthesized sound effects (Web Audio API, no
  external audio files needed for SFX).
- `src/style.css` - all styling: layout, theming, banners, overlays, and
  responsive/mobile rules.
- `src/*.test.ts` - vitest unit tests for the modules above; run with
  `npm test`.
- `public/` - static assets served as-is: background images (WebP), the
  manifest, the app icon, and background music.
- `manifest.json` - PWA metadata / home screen icon config.
- `.github/workflows/ci.yml` - runs `npm test` and `npm run build` on every
  push/PR once this repo has a GitHub remote.

Getting Started
--------------------
This project uses [Vite](https://vitejs.dev/) and TypeScript.

```
npm install
npm run dev      # start a local dev server with hot reload
npm run build    # type-check and produce a production build in dist/
npm run preview  # preview the production build locally
```

There is no backend or database; it is a static site once built. `npm run
build` is required before deploying anywhere (see "Hosting" below), since
the source references `.ts`/`.css` files directly and needs Vite's build
step to produce plain HTML/JS/CSS output.

How to Play
--------------------
1. Open the game and pick a mode on the title screen, then **Dive In** past
   the story intro:
   - **Campaign Mode**: the classic 10-level run. Pick a starting level,
     progress is checkpointed at each level transition (`localStorage`), and
     the title screen offers **Continue Campaign** to resume a run you left
     mid-way. Clearing level 10 ends the run and prompts for the Campaign
     leaderboard.
   - **Endless Mode**: always starts at level 1 with no level picker, keeps
     going past level 10 with escalating difficulty, and has no free resume
     - a death ends the run and prompts for the Endless leaderboard. This is
     the intended hook for a future pay-to-continue offer (see "Ideas for
     Further Development").
2. Click **Start** to begin swimming.
3. Controls:
   - Desktop: Arrow keys or WASD.
   - Mobile: on-screen D-pad, or switch to a virtual joystick with the
     **Controls: D-Pad / Joystick** toggle. You can also touch and hold
     anywhere on the water; the dolphin swims in that direction relative to
     the centre of the screen.
   - **Pause**, or press `Esc`/`P`, to bring up the pause menu at any time.
4. Survive shark attacks, recruit lost dolphins into your pod, and grab the
   magic shrimp when it appears.
5. Grow your pod to 5 dolphins to enter **Hunting Mode**: ramming a shark
   destroys it instead of costing you a life.
6. Clear every shark to trigger **Level Complete**, then swim off the right
   edge of the screen (follow the gold **New Waters** arrow) to move on to
   the Deep Sea level. Your pod does not follow you through; you continue
   alone into tougher waters.

Game Features
--------------------
- **Survival**: a shark bite costs you a pod member; losing your last
  dolphin ends the run with a Game Over banner.
- **Pod growth**: a new stray dolphin appears periodically in a safe corner.
  Swim close to recruit it (with a chime and banner), and recruited
  dolphins flock around you in formation and follow you through the
  screen-wrap edges.
- **Magic Shrimp**: a bonus item appears after 2 minutes.
  - Player dolphin: 30 seconds of double speed.
  - Another dolphin: 30 seconds of invulnerability to sharks.
  - A shark: grows larger and gains a permanent speed boost.
- **Hunting Mode**: once your pod reaches 5, ramming sharks destroys them.
  Clearing every shark completes the level.
- **Level 2, Deep Sea**: swimming through the New Waters prompt loads a new
  background and a tougher shark composition (small and large sharks). Large
  sharks survive ramming until your pod reaches 10, and once all small
  sharks are gone, remaining large sharks will hunt you across the entire
  map regardless of distance.
- **Procedural storm events**: roughly every minute of play there's a chance
  of a 30-second storm that dims the screen and limits how far away you can
  see sharks.
- **Sound**: background music with a mute toggle and volume slider, plus
  procedurally synthesized sound effects (bite, recruit chime, shrimp
  pickup, storm rumble) via the Web Audio API.
- **Pause menu**: freezes the simulation and timers; resume, restart, or
  reset from the overlay, or toggle with `Esc`/`P`.
- **Achievements**: five one-time unlocks (first recruit, first Hunting Mode
  kill, a flawless level, surviving a storm, defeating the Matriarch), each
  with a toast + chime on unlock and a checklist viewable from the
  Achievements button, persisted locally so they carry across runs.
- **First-run tutorial hints**: short one-time tooltips explain Form Pod,
  Hunting Mode, and the Mega Shrimp choices the first time each triggers.
- **Mobile-first controls**: on-screen D-pad or a draggable joystick (your
  choice, remembered between sessions), large touch targets, and a
  fullscreen mode for phones and tablets.
- **Title screen and narrative intro**: shown once per session on first
  "Start Game", not on subsequent Restarts.

Known Issues / Before You Deploy Publicly
---------------------------------------------
- **`public/ambient-music.mp3` needs to be replaced.** The file currently in
  this repo is a placeholder used for local testing and is not
  rights-cleared for distribution. Swap in a licensed or original track
  before building/deploying anywhere public. Budget the replacement to
  roughly 1-2MB compressed (a loopable ~90-180s track at a moderate MP3/OGG
  bitrate is plenty for background music and keeps the PWA/install payload
  reasonable) rather than the current 6MB file.
- Background images in `public/` and `Images/` should be checked for usage
  rights before a public or commercial release. The shark sprite pack in
  `public/sharks/` (sourced from `Images/Free Shark Enemy Pack`) is
  confirmed clear: MutterPixel Studio's license permits commercial use with
  no attribution required (see the pack's own `README.txt`).
- `npm run build` output (`dist/`) is what should be deployed, not the raw
  repository root; the previous "no build step" GitHub Pages setup no
  longer applies now that the project uses Vite and TypeScript.

Ideas for Further Development
-----------------------------
- Android packaging via Capacitor or a Trusted Web Activity, plus PNG app
  icons (192x192/512x512/maskable) for proper install prompts.
- Analytics/crash reporting.
- Cosmetic unlocks, achievements, and daily challenges for longer-term
  retention.
- Split the storm/matriarch/spawning logic still in `src/game.ts` out into
  dedicated system modules, the way `src/entities.ts` and `src/scoring.ts`
  already were. That code is threaded through `step()`/`init()` with a lot
  of shared private state, so it needs either an interface redesign or
  broader test coverage first to extract safely.
- Pay-to-continue on Endless Mode game over: the death handling in
  `Game.gameOver()` already branches on endless mode and is the intended
  hook, but no payment integration exists yet (that depends on the
  Capacitor/AdMob/Play Billing work described in the Late August plan).

Original Python Model
-----------------------------
The original agent-based model (`Agentbasedmodel.py` and
`agentframework.py`, in the parent repository) simulated deer and wolf
population dynamics using matplotlib for animation. It is kept for
reference but is no longer the primary version of this project.

License
---------------------
This project is licensed under the ISC license.

---------------------------------------------------------------------
Originally developed for Programming for Geographic Information Analyses,
University of Leeds. Since evolved into an independent browser game project.
