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
- `src/game.ts` - core game/simulation logic: dolphins, sharks, movement,
  collisions, Hunting Mode, procedural storm events, level transitions,
  banners, and the render loop.
- `src/sprites.ts` - PixiJS Graphics-based dolphin and shark sprite factories.
- `src/particles.ts` - lightweight pooled particle system (bubbles, wakes,
  hit sparks, sparkles).
- `src/sfx.ts` - procedurally synthesized sound effects (Web Audio API, no
  external audio files needed for SFX).
- `src/style.css` - all styling: layout, theming, banners, overlays, and
  responsive/mobile rules.
- `public/` - static assets served as-is: background images, the manifest,
  the app icon, and background music.
- `manifest.json` - PWA metadata / home screen icon config.

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
1. Open the game and click **Start Game** on the title screen, then **Dive
   In** past the story intro.
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
  before building/deploying anywhere public.
- Background images in `public/` and `Images/` should be checked for usage
  rights before a public or commercial release.
- `npm run build` output (`dist/`) is what should be deployed, not the raw
  repository root; the previous "no build step" GitHub Pages setup no
  longer applies now that the project uses Vite and TypeScript.

Ideas for Further Development
-----------------------------
- Data-driven level definitions (shark counts/sizes/speeds, background,
  win condition) instead of hand-written per-level spawn methods, to make
  adding a third level and beyond easier.
- Persistent high scores / best times using local storage.
- Android packaging via Capacitor or a Trusted Web Activity, plus PNG app
  icons (192x192/512x512/maskable) for proper install prompts.
- Analytics/crash reporting, and a CI pipeline running `tsc`/`vite build` on
  every push.
- Cosmetic unlocks, achievements, and daily challenges for longer-term
  retention.

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
