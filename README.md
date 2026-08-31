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
- `index.html` - page markup: splash screen, title screen, narrative screen,
  settings panel, game canvas, on-screen controls, and audio elements.
- `src/main.ts` - entry point: wires up all UI (buttons, D-pad, joystick,
  volume, pause menu, fullscreen) to the `Game` class.
- `src/game.ts` - core game/simulation orchestration: level flow, spawning,
  Hunting Mode, procedural storm/jellyfish events, the matriarch boss, the
  Mega Shrimp upgrade choices, banners, and the render loop.
- `src/entities.ts` - the Dolphin, Shark, MagicShrimp, and Jellyfish classes
  and their movement logic (no Pixi/DOM dependencies).
- `src/scoring.ts` - local top-10 leaderboard persistence (`localStorage`),
  separate boards for Campaign and Endless; entries are stamped with the
  dolphin's name.
- `src/profile.ts` - the player's dolphin name (`localStorage`, default `Echo`,
  editable from the pause menu).
- `src/achievements.ts` - the achievement definitions and unlock/seen
  persistence (`localStorage`).
- `src/lifetimeStats.ts` - cumulative cross-run totals (dolphins saved, sharks
  killed, play time, distinct play days) backing the lifetime achievements;
  `localStorage`.
- `src/pearls.ts` - the persisted Pearl currency balance (`localStorage`), the
  per-level payout formula, and the spend path.
- `src/store.ts` - the Store: persisted purchases (`localStorage`) of permanent
  Endless-mode stat upgrades and dolphin skins, plus the derived Endless starting
  bonuses.
- `src/skins.ts` - the dolphin skin catalogue (palette swaps, prices; `source`
  marks the share-only reward skin).
- `src/storeView.ts` - renders and wires the Store screen.
- `src/share.ts` - Web Share API wrapper (clipboard fallback) for the campaign /
  Level 50 milestone Share buttons and the Voyager-skin reward.
- `src/platform.ts` - the `isAndroid` flag that gates all monetisation.
- `src/ads.ts` / `src/iap.ts` - AdMob and Play Billing wrappers (Android only;
  every method is a no-op on web). Back the paid/rewarded Continue - see
  Monetisation below.
- `src/tutorialHints.ts` - first-run tooltip seen/unseen persistence
  (`localStorage`).
- `src/music.ts` - the ambient/boss track lists and random-pick helper (see
  Music below).
- `src/utils.ts` / `src/constants.ts` - shared world-space math helpers
  (wrap/clamp/direction) and the SIZE/CANVAS_SIZE constants they use.
- `src/levels.ts` - the ten-level campaign as data (shark composition,
  counts, speed scaling, pod requirements) rather than per-level code.
- `src/sprites.ts` - sprite factories. The dolphin is a countershaded body
  rendered once to a shared texture (from `DEFAULT_DOLPHIN_PALETTE` - swap it
  for cosmetic skins later) plus a live fluke that `game.ts` animates; sharks
  are the MutterPixel PNG strips; the jellyfish is procedural Graphics.
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
npm run build:android          # = npm run build + `cap sync android`
cd android && ./gradlew bundleRelease   # -> app/build/outputs/bundle/release/app-release.aab
```

The `cap sync` step is essential and easy to forget: Gradle builds from
`android/app/src/main/assets/public/` (gitignored), which only picks up a new
`dist/` when `cap copy`/`cap sync` has run. Skipping it silently ships stale
web assets.

Play Games Services (leaderboards)
--------------------
Online leaderboards are **Android only** - a small local Capacitor plugin
(`android/app/src/main/java/.../PlayGamesPlugin.java`, wrapped by
`src/playGames.ts`) submits the two run results to Play Games Services and shows
the player's global rank in the existing Leaderboard overlay. On web / PWA
`playGames.available` is `false` and the whole thing is skipped - the local
`localStorage` leaderboards (`src/scoring.ts`) are unchanged and remain the only
board there.

The IDs below are **not secrets** (they ship in every APK), so they are
committed with placeholders rather than gitignored. Sign-in simply fails and the
app falls back to local boards until real values are set.

One-time setup in Play Console / Google Cloud:

1. Play Console -> your app -> **Play Games Services -> Setup** -> create or link
   a Google Cloud project.
2. Google Cloud Console -> **OAuth consent screen** (External; add your own
   Google account as a test user).
3. Play Games Services -> **Credentials -> Android**: package
   `com.sharksvsdolphins.app`, plus SHA-1 fingerprints for
   - the debug keystore (`~/.android/debug.keystore`, password `android`) for dev,
   - the upload keystore:
     `keytool -list -v -keystore android/keystore/release.keystore -alias svsd-release`
     (password in `keystore.properties`),
   - and, once Play App Signing is active, the app-signing SHA-1 from
     Play Console -> Test and release -> Setup -> App signing.
4. Create two leaderboards:
   - **Fastest Ocean Rescue** - score formatting *Time*, ordering *Smaller is better*
   - **Deepest Waters** - score formatting *Numeric*, ordering *Larger is better*
5. Copy the numeric **Project ID** into
   `android/app/src/main/res/values/games-ids.xml`, and the two **Leaderboard IDs**
   (`CgkI...`) into `LEADERBOARD_IDS` in `src/playGames.ts`.
6. Play Games Services -> **Testers** -> add your Google account, then **publish**
   the Play Games Services configuration (separate from publishing the app).

Sign-in and score submission only work in a signed build on a real device with a
tester account - Play Games sign-in does not work on most emulators.


Monetisation (Android only)
--------------------
The **PWA build has no ads and no purchases** - it is left as-is for testing.
Everything below is gated on `isAndroid` (`src/platform.ts`); on web
`ads.available` / `iap.available` are `false` and every code path is skipped.

- **Continue offer** - after an **Endless** Game Over the player is offered one
  Continue per run: *watch a rewarded ad* (free) or *buy it* (a real
  `continue_run` consumable). Taking either revives the player mid-run with a
  fresh 3-dolphin pod and 4s of invulnerability; the sharks, level, and score all
  carry over. Declining shows the normal run-summary card.
- **Interstitial** - a full-screen ad every 3rd Endless death, shown at the
  natural break as the run-summary is dismissed.
- **No Retry button on Android** - after Game Over the run is genuinely over
  unless you Continue. The run-summary card and a small Game Over panel gain a
  **Main Menu** button; Campaign keeps its checkpoint (**Continue Campaign** from
  the title resumes it).

Local plugins mirror `PlayGamesPlugin`:
`android/app/src/main/java/.../AdsPlugin.java` (AdMob rewarded + interstitial +
UMP consent, wrapped by `src/ads.ts`) and `.../BillingPlugin.java` (Play Billing
consumable, wrapped by `src/iap.ts`).

**Ships with Google's official TEST ad IDs** so a debug build shows test ads and
can never trip an AdMob policy strike. One-time setup before a production release:

1. **AdMob** -> create an app, plus a **Rewarded** and an **Interstitial** ad
   unit. Put the real app id in
   `android/app/src/main/res/values/ads-ids.xml` and the real unit ids in
   `UNITS` in `src/ads.ts`. Add your test device in the AdMob console.
2. **AdMob -> Privacy & messaging** -> create a **GDPR** consent message
   (the UMP flow is already wired in `AdsPlugin.initialize`).
3. **Play Console -> Monetize -> Products -> In-app products** -> create a
   **consumable** managed product with ID `continue_run` and a price.
4. **Play Console -> App content**: *Ads* -> **contains ads**; declare the IAP;
   update the **Data safety** form (AdMob collects an advertising ID) - Google
   publishes an AdMob data-safety guidance page to follow.
5. Test on a **real device** with a licensed test account - ads and billing do
   not work on most emulators.

How to Play
--------------------
1. On load a splash screen shows the logo big - tap or press any key to reach
   the title screen - then pick a mode. On your first play the story intro also
   asks you to **name your dolphin** (default `Echo`); the name sticks and is
   editable from the pause menu. Then **Dive In**:
   - **Campaign Mode**: the classic 10-level run. Pick a starting level,
     progress is checkpointed at each level transition (`localStorage`), and
     the title screen offers **Continue Campaign** to resume a run you left
     mid-way. Clearing level 10 ends the run and prompts for the Campaign
     leaderboard.
   - **Endless Mode**: always starts at level 1 with no level picker, keeps
     going past level 10 with escalating difficulty, and has no free resume
     - a death ends the run. This is the intended hook for a future
     pay-to-continue offer (see "Ideas for Further Development").
   - **Store** (title screen): spend Pearls on permanent **Endless upgrades**
     (Vitality, Speed, Charisma, Boost Cooldown, and Boost Duration - they seed
     an Endless run's starting stats and stack with the Mega Shrimp picks you
     make during the run; Campaign is unaffected) and **dolphin skins** (palette
     recolours of the whole pod, one equipped at a time). The **Voyager** skin
     can't be bought - it shows as "Share to unlock" until earned.
   Both endings show a **run-summary card** - dolphin name, a stat breakdown,
   and any achievements unlocked that run - then let you save the score (under
   your dolphin's name) to the leaderboard, or Skip.
   - **Share**: clearing the Campaign, and clearing **Level 50** in Endless
     (a milestone card that pauses the run), each offer a **Share** button. The
     first successful share unlocks the exclusive **Voyager** skin. A real
     social post can't be detected, so the reward fires whenever the OS share
     sheet completes without being cancelled (or a clipboard-copy fallback
     succeeds).
   - **About Me** (title screen): the developer's bio, a contact email, and a
     Buy Me a Coffee button (its URL is a `COFFEE_URL` placeholder in
     `src/main.ts` for now).
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
5. Grow your pod to 4 dolphins to enter **Hunting Mode**: ramming a shark
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
- **Hunting Mode**: once your pod reaches 4, ramming *small* sharks destroys
  them. *Large* sharks (marked with a ⚡ and a higher number) also need you to
  be **Boosting** - tap Space, or the ⚡ button - into them at the moment of
  contact; a big pod alone will not finish one. Clearing every shark completes
  the level.
- **Level 2, Deep Sea**: swimming through the New Waters prompt loads a new
  background and a tougher shark composition (small and large sharks). Large
  sharks survive a ram until the pod meets their number (per level, shown above
  each shark) *and* you Boost into them. They are also more alert: a large shark
  picks you up from 40 units away where a small one only notices you at 25, and
  once all small sharks are gone, every remaining large shark will hunt you
  across the entire map regardless of distance. Great whites and hammerheads
  never lose track of you at all.
- **Large tigers cloak**: with the small sharks cleared, a large tiger drops out
  of sight completely for 20 seconds while it keeps hunting you, then has to
  spend 20 visible seconds recharging. Taking a dolphin gives it away
  immediately - it surfaces and starts the recharge early. Watch for the puff of
  water it leaves as it goes.
- **Procedural events**: roughly every minute of play there's a chance of a
  30-second **storm** that dims the screen and limits how far you can see
  sharks, or a **jellyfish swarm** - a wall of jellyfish drifting across the
  water that stings any dolphin it touches. The pod stays together through the
  swarm; thread the whole group through the gaps (getting everyone through
  unstung unlocks an achievement).
- **Dolphins Saved / Mega Pod finale (Campaign mode)**: at every level
  transition, the size of your outgoing pod is added to a running "Dolphins
  Saved" total for the run, and the departing companions swim off-screen
  rather than just vanishing. On level 10, once the Matriarch's escort
  sharks are cleared, a Summon Mega Pod button appears that calls every
  saved dolphin back in at once for the final push. Not tracked in Endless
  mode, which has no defined ending for the total to pay off at.
- **The Matriarch**: the campaign's level-10 boss (and an Endless boss every
  10 levels). She hits hard - a bite from her costs you **two** pod members,
  not one. In Endless the finishing hit doesn't destroy her; she flashes
  damaged and flees off-screen, so the encounter repeats at the next 10-level
  mark rather than ending the run, and she only counts toward the Matriarch
  Slayer achievement and the sharks-killed stat on an actual Campaign kill.
- **Pearls**: a soft currency that persists on the device across playthroughs
  (`src/pearls.ts`). Clearing a level pays out `10 + level` Pearls (`+5` for
  losing no dolphins that level) in either mode; clearing the Campaign adds a
  `100` bonus (`+50` if no dolphin was lost all run). The balance shows on the
  title screen, a HUD badge, and the run-summary card, and is spent in the
  **Store**.
- **Store** (`src/store.ts` / `src/storeView.ts`): a title-screen shop that
  spends Pearls on permanent Endless-mode stat upgrades (Vitality, Speed,
  Charisma, Boost Cooldown, Boost Duration - all tiered) and dolphin skins
  (`src/skins.ts` - palette recolours applied to the whole pod). Purchases
  persist in `localStorage`.
- **Milestone sharing** (`src/share.ts`): a Share button on the campaign-clear
  run-summary card and on a "Level 50!" milestone card in Endless (which pauses
  the run until you Share or Keep Diving). The first successful share grants the
  exclusive **Voyager** skin - shown as "Share to unlock" in the Store until then.
- **Sound**: dynamic background music (see Music below) with a mute toggle
  and volume slider, plus procedurally synthesized sound effects (bite,
  recruit chime, shrimp pickup, storm rumble) via the Web Audio API.
- **Kill juice**: a brief freeze-frame (hit-stop) and a light screen shake when a
  large shark is destroyed, and a kill sound whose pitch climbs as you chain
  kills (resetting after a gap or a lost dolphin). The freeze and shake are
  skipped under the OS "reduce motion" setting.

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
copies, re-encoded from the 256 kbps sources to LAME VBR V3 (~175 kbps) to
roughly halve the download without an audible drop. See `CREDITS.md` for
sources and licenses. To re-derive the served copies from source, run them
through `ffmpeg -i <src> -c:a libmp3lame -q:a 3 -ar 44100 -ac 2 -map_metadata -1`.
- **Pause menu**: freezes the simulation and timers; resume, restart, or
  reset from the overlay, or toggle with `Esc`/`P`.
- **Achievements**: 22 one-time unlocks, each with a toast + chime and a
  checklist behind the Achievements button, persisted locally. Most track a
  single run (first recruit, a flawless level, clearing level 5, a sub-12-minute
  campaign, a no-retry campaign, reaching Endless level 15/25/40, summoning the
  Mega Pod, ...); a handful are cumulative across every run (save 100 / 1,000
  dolphins, destroy 100 / 1,000 sharks, play on 7 days, 10 hours total) and are
  backed by `src/lifetimeStats.ts`. When multiple unlock at once (a campaign
  clear can trigger several) the toasts queue and show in turn.
- **First-run tutorial hints**: short one-time tooltips explain Form Pod,
  Hunting Mode, and the Mega Shrimp choices the first time each triggers.
- **Mobile-first controls**: on-screen D-pad or a draggable joystick (your
  choice, remembered between sessions), large touch targets, and a
  fullscreen mode for phones and tablets.
- **Title screen and narrative intro**: shown once per session on first
  "Start Game", not on subsequent Restarts.

Known Issues / Before You Deploy Publicly
---------------------------------------------
- **Asset licenses are documented in `CREDITS.md`.** Summary: the old
  copyrighted placeholder track (a Nintendo song) is gone; all six
  replacement tracks in `public/music/` are Pixabay, commercial-use OK. The
  shark sprites are MutterPixel Studio (commercial OK). The level backgrounds
  and app icon are Leonardo AI generations owned by the project author. Two
  open caveats are noted in `CREDITS.md`: the MutterPixel pack's
  "no redistribution as standalone files" clause vs. this repo being public,
  and the limited copyright protection AI-generated images carry.
- `npm run build` output (`dist/`) is what should be deployed, not the raw
  repository root; the previous "no build step" GitHub Pages setup no
  longer applies now that the project uses Vite and TypeScript.

Hosting / PWA
--------------------
`.github/workflows/pages.yml` builds `dist/` and deploys it to GitHub Pages on
every push to `main`. For it to run, the repo's **Settings -> Pages -> Source**
must be set to **"GitHub Actions"** (not "Deploy from a branch" - that publishes
the raw, unbuilt source and the game will not start).

Once deployed, `https://<user>.github.io/SharksVsDolphins/` serves the full
installable PWA: open it in Chrome (desktop or Android) and choose
"Install app" / "Add to Home screen" to run it standalone with the Workbox
service worker caching assets for offline play. `vite.config.ts` sets
`base: './'` so it works correctly under the `/SharksVsDolphins/` sub-path.

The same `dist/` is what Capacitor wraps for the Android app (see
`npm run build:android`), so the PWA and the native app always match.

Ideas for Further Development
-----------------------------
- Android packaging via Capacitor or a Trusted Web Activity, plus PNG app
  icons (192x192/512x512/maskable) for proper install prompts.
- Analytics/crash reporting.
- Daily challenges and a daily Pearl bonus for longer-term retention (cosmetic
  unlocks and achievements are now in - see the Store and Achievements).
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
