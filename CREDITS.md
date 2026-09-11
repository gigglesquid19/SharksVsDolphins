Credits & Asset Licenses
========================

Every third-party asset shipped in (or bundled alongside) the app, with its
source and the terms it is used under. Keep this current whenever an asset is
added, replaced, or removed.


Audio
-----

### Music — Pixabay

All six background tracks were downloaded from **Pixabay** and are used under
the **Pixabay Content License** (https://pixabay.com/service/license-summary/):
free for commercial use, **no attribution required**; the audio files may not be
redistributed as standalone downloads, resold, or used to imply endorsement.

Source files live in `audio/Ambient/` and `audio/Boss/` (the project's
convention for original assets); the served copies are in `public/music/`.
Titles below are taken from the download filenames.

| In game | Title (from filename) | Pixabay uploader | Pixabay track ID |
|---|---|---|---|
| `ambient-1.mp3` | Ocean Waves Chill | alex-morgan | 537452 |
| `ambient-2.mp3` | The Ocean | nojisuma | 122252 |
| `ambient-3.mp3` | Fantasy Worlds – Enchanted Garden | vadim_makes_sound | 570007 |
| `boss-1.mp3` | Dark Fight Music (Boss) | montogoronto | 142794 |
| `boss-2.mp3` | Fast Battle – Intense 8-Bit Chiptune | nickpanek | 378777 |
| `boss-3.mp3` | Multi-Boss – Fast-Paced 8-Bit Chiptune | nickpanek | 358679 |

To re-locate a track's Pixabay page, search its ID on pixabay.com.

> Note: Pixabay music is non-exclusive — other apps use the same tracks, and a
> few Pixabay tracks have historically been flagged by platform content-ID
> systems. This is not a licensing problem for a Play Store release, but is
> worth knowing if a store video ever gets an automated music claim.

### Sound effects

Every sound is procedurally synthesized at runtime with the Web Audio API
(`src/sfx.ts`) except one, below.

#### Recorded effects — Pixabay

Three sounds are recordings rather than synthesis, all from **Pixabay** under the
**Pixabay Content License**: free for commercial use, no attribution required,
but not to be redistributed as standalone downloads. Source files in
`audio/Sfx/`; the served copies are in `public/sfx/`.

| In game | Source filename | Pixabay uploader | Pixabay sound ID |
|---|---|---|---|
| `dolphin-recruit.mp3` | `sondangsirait419-lumba-lumba-220055.mp3` | sondangsirait419 | 220055 |
| `shark-bite.mp3` | `makigai_maimai-crunchy-bite-450650.mp3` | makigai_maimai | 450650 |
| `big-kill.mp3` | `universfield-punch-140236.mp3` | universfield | 140236 |
| `matriarch-hit.mp3` | `MatriarchHit3.mp3` | **unconfirmed** | **unconfirmed** |
| `level-complete.mp3` | `LevelComplete.mp3` | **unconfirmed** | **unconfirmed** |
| `game-over.mp3` | `GameOver.mp3` | **unconfirmed** | **unconfirmed** |

> The last three were supplied already renamed, so their original uploaders and
> sound IDs are not recoverable from the filenames. Confirm their sources before
> any store release: anything not covered by Pixabay's licence (or another
> permitting commercial use) has to be replaced. The first three were identified
> from their original download filenames.

`dolphin-recruit.mp3` plays when a dolphin joins the pod: trimmed to drop 18ms
of leading silence, raised 6dB (peak -1.8dB), 45ms fade-out, mono at 96kbps —
7.5KB.

`shark-bite.mp3` plays when a dolphin is taken. The source holds eleven separate
takes across 16 seconds; this is the second (2.33s in, 150ms), chosen because it
carries the least high-frequency sizzle of the loud ones — 11.6% of its energy
above 2kHz against 25-55% for the rest — so it reads as flesh rather than as a
dry snack. Shelved -4dB above 4kHz, raised 6dB (peak -3.6dB), 33ms fade-out,
mono at 96kbps — 3.2KB. Only the crunch is sampled: the impact underneath and
the water closing over it are still synthesized, because the recording is
close-mic'd and dry.

`big-kill.mp3` plays when a boosting pod destroys a large shark, alongside the
freeze-frame and screen shake. Taken from 70ms in (240ms of punch), lowered 4dB
for headroom because the source sits at -0.6dB and the encoder overshoots into
clipping otherwise (peak -1.6dB), 60ms fade-out, mono at 96kbps — 6.2KB. It has
weight rather than brightness: 12% of its energy above 2kHz, which is why it
reads as a body blow and not a slap.

`matriarch-hit.mp3` plays each time the Mega Pod lands a hit on the Matriarch,
the finishing blow included, and in Endless when the pod drives her off. Taken
from 45ms in (1.8s), lowered 4dB for headroom (peak -2.8dB), 300ms fade-out,
mono at 96kbps — 22KB. It is deliberately far heavier than the large-shark
impact: all of its energy sits below 2kHz and it rings for over a second, so a
boss hit does not sound like an ordinary kill.

`level-complete.mp3` (2.6s, 32KB) plays when a level is cleared and
`game-over.mp3` (5.4s, 66KB) when a run ends. Both are musical phrases rather
than impacts, so unlike the others they are trimmed only where the source had
gone quiet — audible content ended at 2.4s and 5.0s respectively — and both duck
the background music to 30% for their duration (`onMusicDuck` in `src/main.ts`).
Nothing stops the level music at a game over, and a five-second phrase over a
running loop just sounds muddy.

All six have synthesized fallbacks in `src/sfx.ts` covering the first play of a
session, before the files have finished loading.


Graphics
--------

### Enemy shark sprites — MutterPixel Studio

`public/sharks/spr_*_strip9.png` (great white, hammerhead, tiger — move and
attack strips), loaded in `src/game.ts`. Source pack:
`Images/Free Shark Enemy Pack – Animated Pixel Art/`.

License (full text in that folder's `README.txt`): commercial use permitted,
modification permitted, **attribution appreciated but not required**. Prohibited:
reselling or redistributing the assets as standalone files or inside an asset
pack, NFT/blockchain use, and use as AI-training data.

Suggested credit for the store listing / in-game about screen:
*"Shark sprites by MutterPixel Studio."*

> Because this repository is **public**, the raw sprite PNGs are visible and
> downloadable from it. That sits awkwardly against the pack's "no
> redistribution as standalone files" clause. Options: keep the repo private,
> or keep the sprite *sources* out of git (the built `dist/` would still carry
> them, which is normal use). Low practical risk, but a deliberate call to make.

### Level backgrounds & app icon — Leonardo AI

`Images/1.jpg`–`10.jpg` (served as `public/levels/1.webp`–`10.webp`),
`Images/GameLogo.jpg` (the Android launcher and splash art),
`Images/StartMenuShop/Shop1.jpg` & `Shop2.jpg` (`Shop2.jpg` served as
`public/shop-bg.webp`, the Store screen background; `Shop1.jpg` is an unused
alternate), and the unused candidates in `Images/Alternatives/` were generated by
the project author using **Leonardo AI**.

Under Leonardo.Ai's Terms of Service, the account holder is granted the rights
to use images generated on their account, **including commercially**. Keep the
Leonardo account (and its plan at time of generation) able to evidence this.

> Separately: purely AI-generated images may receive limited or no copyright
> protection in some jurisdictions — you can ship them, but you may not be able
> to stop others from copying them. This does not affect your right to release
> the game.

### About Me photo

`public/about-me.webp` (from `Images/AboutMe/AboutMe.jpeg`, resized by
`tools/generate_about_image.py`) is the project author's own photograph. No
third-party rights involved.

### Pearl currency icon — Mischeal

`public/pearl.png` is a single 16×16 tile cropped (by `tools/extract_pearl.py`)
from `Images/Treasure pack [16x16] by Mischeal/Treasure_pack_ores.png` — the
"Treasure pack [16x16]" by **Mischeal**.

License (`Read me.txt` in that folder): *"This work is licensed under a Creative
Commons Attribution 4.0 International License."* CC BY 4.0 permits commercial use
and modification (the crop) provided attribution is given.

Required credit for the store listing / in-game about screen:
*"Treasure icons by Mischeal (CC BY 4.0)."*

### In-game creatures and effects

Dolphins, the HUD creatures, jellyfish, and all particles (bubbles, wakes, hit
sparks) are drawn procedurally with PixiJS Graphics — `src/sprites.ts` and
`src/particles.ts`. Original to this project.

### Not shipped

`Images/octopus-jellyfish-shark-and-turtle-free-sprite-pixel-art.zip` is not
extracted, referenced, or bundled. If it is ever used, record its license here
first.


Fonts
-----

System font stack only (`-apple-system`, `Segoe UI`, `Roboto`, `Helvetica
Neue`, `Arial`, `sans-serif`). No bundled or web-hosted fonts.


Code / libraries
----------------

| Library | License | Role |
|---|---|---|
| PixiJS (`pixi.js`) | MIT | WebGL renderer — bundled |
| Capacitor (`@capacitor/core`, `@capacitor/android`) | MIT | native Android wrapper — bundled |
| Google Mobile Ads SDK (`play-services-ads`) + UMP | [Android Software Development Kit License](https://developer.android.com/studio/terms) | rewarded / interstitial ads — Android build only |
| Google Play Billing Library (`billing`) | Android SDK License | the paid Continue — Android build only |
| Google Play Games Services v2 (`play-services-games-v2`) | Android SDK License | leaderboards — Android build only |
| Vite, Vitest, TypeScript, `vite-plugin-pwa` | MIT | build and test tooling — not shipped |

The game's own source is under the ISC license (see `README.md`).
