SharksVsDolphins
=====================
[![CI](https://github.com/gigglesquid19/SharksVsDolphins/actions/workflows/ci.yml/badge.svg)](https://github.com/gigglesquid19/SharksVsDolphins/actions/workflows/ci.yml)

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
- `src/music.ts` - the ambient/boss track lists and random-pick helper (see
  Music below).
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

Versioning
--------------------
The single source of truth for the app version is the `version` field in
`package.json` (repo root). Bump it there and nothing else needs editing:

```
npm version patch    # bug-fix release   1.0.0 -> 1.0.1
npm version minor    # new features      1.0.1 -> 1.1.0
npm version major    # breaking / big    1.1.0 -> 2.0.0
```

`android/app/build.gradle` reads `package.json` at configure time and derives
both Android version fields from it:

- **`versionName`** - the semver string verbatim (`1.2.0`). This is what
  players see on the Play Store listing.
- **`versionCode`** - computed as `MAJOR*10000 + MINOR*100 + PATCH`, so
  `1.0.0` -> `10000`, `1.4.2` -> `10402`, `2.0.0` -> `20000`. Google Play
  requires this integer to increase on every upload; the formula guarantees
  that as long as the semver goes up, and leaves room for up to 99 minor and
  99 patch releases between steps. Any pre-release suffix (`1.2.0-beta.1`) is
  ignored when computing the code.

The first Play Console upload will therefore be `versionCode 10000` /
`versionName 1.0.0` (the earlier local debug APKs were the Capacitor template
default of `versionCode 1`, which is lower, so this is a clean increase).
`capacitor.config.ts` intentionally does **not** set a version - keeping it in
one place avoids the two drifting apart.

Android launcher icon
--------------------
The launcher icon is generated from `Images/GameLogo.jpg` (a 1024x1024
shark-vs-dolphin illustration) by `tools/generate_android_icons.py`, which
writes the legacy square/round PNGs and the API-26+ adaptive-icon layers into
`android/app/src/main/res/mipmap-*`. The whole scene lives in the adaptive
*background* layer (blurred edge-extension fills the canvas, the sharp scene
stays inside the safe zone); the *foreground* layer is deliberately empty.
Re-run the script (`python tools/generate_android_icons.py`) whenever
`GameLogo.jpg` changes, then rebuild. The web/PWA icons in `public/` are
separate and still the older fin artwork.

The same script also generates the Android 12+ launch-screen icon
(`drawable-*/splash_icon.png`); the launch screen shows it centred on a
deep-ocean fill (`@color/splashBackground`, matching the web manifest's
`background_color`), configured in `android/app/src/main/res/values/styles.xml`.

Android release signing
--------------------
The `release` build type is signed with the upload keystore described in
`android/keystore/keystore.properties`. That file and the `.keystore` beside it
are **gitignored and must be backed up somewhere safe** - losing the keystore
means never being able to update the same Play Store listing again.

`android/app/build.gradle` loads the properties file if it is present and signs
`assembleRelease` / `bundleRelease` with it; if the file is absent (a fresh
clone, or CI without the secret) the release build is simply left unsigned so
debug builds and tests are never blocked. Produce the Play upload with:

```
npm run build
cd android && ./gradlew bundleRelease   # -> app/build/outputs/bundle/release/app-release.aab
```

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
- **Dolphins Saved / Mega Pod finale (Campaign mode)**: at every level
  transition, the size of your outgoing pod is added to a running "Dolphins
  Saved" total for the run, and the departing companions swim off-screen
  rather than just vanishing. On level 10, once the Matriarch's escort
  sharks are cleared, a Summon Mega Pod button appears that calls every
  saved dolphin back in at once for the final push. Not tracked in Endless
  mode, which has no defined ending for the total to pay off at.
- **The Matriarch in Endless mode**: reappears every 10 levels past the
  campaign. Landing the finishing hit doesn't destroy her here - she
  flashes damaged and flees off-screen instead, so the same encounter
  repeats at the next 10-level mark rather than ending the run. She only
  counts toward the Matriarch Slayer achievement and the sharks-killed
  stat on an actual kill, which now only happens in Campaign mode.
- **Sound**: dynamic background music (see Music below) with a mute toggle
  and volume slider, plus procedurally synthesized sound effects (bite,
  recruit chime, shrimp pickup, storm rumble) via the Web Audio API.

Music
--------------------
Six tracks live in `public/music/`: three ambient (`ambient-1/2/3.mp3`) and
three boss (`boss-1/2/3.mp3`), picked randomly at runtime by
`src/music.ts`/`Game.applyLevelMusic()` (called whenever the current level
number changes - a same-level retry leaves the current track alone):
- A fresh run (level 1) picks a random ambient track and loops it.
- A boss level (level 10 in Campaign; every 10th level in Endless) picks a
  random boss track the moment it starts.
- The level right after a boss level picks a fresh random ambient track and
  loops that until the next boss level.
- Any other level transition leaves whatever's currently playing alone, so
  the ambient track spans the whole block between boss levels.

Source `.mp3`s for both sets also live in `audio/Ambient/` and
`audio/Boss/` (the project's convention for original/source assets, mirroring
`Images/` for the level backgrounds) - `public/music/` holds the served
copies. See Known Issues below for their license status.
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
- The old copyrighted placeholder track (`public/ambient-music.mp3`, a
  Nintendo song) has been removed and replaced by the six-track system in
  `public/music/` (see Music above). **License status of the six new
  tracks is not yet documented** - they need their source/license recorded
  (a credits file, per Store Readiness below) before a public release,
  even though none of them are commercial game music like the old
  placeholder was.
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
