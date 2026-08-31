Play Store Listing — Sharks vs Dolphins
=======================================

Everything below is a draft to paste into the Play Console. Placeholders in
[BRACKETS] need your input.


Store listing
-------------

**App name** (30 char max)
```
Sharks vs Dolphins
```

**Short description** (80 char max — shown in search results)
```
Dodge the sharks, rebuild your pod, and turn the hunt around. One-thumb ocean action.
```
_(83 chars — trim to:)_
```
Dodge sharks, rebuild your pod, turn the hunt around. One-thumb ocean action.
```

**Full description** (4000 char max)
```
You are Echo, a dolphin torn from your pod and adrift in shark-hunted water.
Survive. Regroup. Then turn the tables.

Swim with one thumb — a D-pad, a floating joystick, or just hold anywhere on
the water. Dodge the sharks circling you, and every so often a lost dolphin
drifts into a safe corner: reach it and it joins your pod, flocking around you
in formation.

Get your pod to five and you enter HUNTING MODE — now ramming a shark destroys
it instead of costing you a life. Clear the water to finish the level and swim
on into deeper, tougher seas.

FEATURES
• Campaign — ten hand-built levels, from open shallows to the deep, ending in a
  boss fight against the Matriarch and her escort.
• Endless — the campaign never stops; difficulty keeps climbing and the
  Matriarch returns every ten levels. Chase your deepest run.
• Name your dolphin, then chase two leaderboards — fastest Campaign clear and
  deepest Endless run — all stored on your device.
• The Mega Pod finale — every dolphin you save across a Campaign run is banked,
  then called back all at once for the final push against the Matriarch.
• Magic Shrimp power-ups, procedural storms that cut your visibility, a sprint
  dash on a cooldown, achievements, and first-run tips that only show once.
• Procedurally synthesized sound effects and a dynamic ambient / boss
  soundtrack.

No account needed. The only ads are an optional "watch to continue" after an
Endless Game Over, plus an occasional full-screen ad between runs — there are no
banners and nothing interrupts you mid-game. A one-tap purchase to continue a run
is offered as an alternative to the ad. Everything else runs offline on your
device.
```

**Category:** Game › Arcade  (Action is also fine)
**Tags:** arcade, action, survival, casual
**Contact email:** [YOUR CONTACT EMAIL]
**Website:** [OPTIONAL — e.g. the GitHub Pages URL if you enable it]
**Privacy policy URL:** [URL where you host store/privacy-policy.md]


Graphics assets (in this folder)
--------------------------------
| Asset | File | Play spec |
|---|---|---|
| App icon | `icon-512.png` | 512×512 PNG, done |
| Feature graphic | `feature-graphic.png` | 1024×500 PNG, done |
| Phone screenshots | `screenshots/` | 2–8 needed — see `screenshots/HOW-TO-CAPTURE.md` |

Play also shows the adaptive launcher icon from the app itself; the 512 icon
above is the separate store-listing icon.


Data safety form
----------------

> The current Android build **has AdMob + Play Billing wired in** (test IDs by
> default). Once you ship with real ad IDs, the "without ads" option below no
> longer applies — AdMob collects a device/advertising ID, so the answer to
> "collect or share user data" becomes **Yes**. See the AdMob section.

**AdMob (once real ad IDs are set):**
- **Collect or share user data?** → **Yes**.
- **Data type:** *Device or other IDs* (the advertising ID), and *App activity*.
  Collected **and shared** with Google. Purpose: *Advertising or marketing* +
  *App functionality*. May be used for personalised ads unless the user declines
  via the UMP consent form.
- **Encrypted in transit:** Yes. **Deletion:** users reset their advertising ID
  in Android settings.
- Follow Google's *AdMob data safety* guidance page for the exact checkboxes.
- **In-app purchases:** the `continue_run` consumable — no user data beyond
  what Google Play Billing handles.

**If you ship WITHOUT ads** (test IDs left in, or ad units removed):
- **Does your app collect or share any of the required user data types?** → **No**
- Rationale: no analytics or accounts; the only persisted data is local
  `localStorage`, which never leaves the device.

**If you ship WITH Play Games Services leaderboards enabled** (in addition to the above):
- **Does your app collect or share any user data?** → **Yes** (via Google Play
  Games Services)
- **Data type:** *App activity → Other actions / game progress*, and a Play Games
  player ID. Collected and shared with Google. Purpose: *App functionality*
  (leaderboards). Not linked to a resettable advertising ID; not used for tracking.
- **Encrypted in transit:** Yes (handled by Google Play Games Services).
- **Deletion:** players manage their Play Games data in their Google account.
- Google publishes a Play Games Services data-safety guidance page — follow it for
  the exact checkboxes.


Content rating questionnaire
----------------------------
Answer the IARC questionnaire truthfully; expected answers for this app:

- **Category:** Game.
- **Violence:** the game contains **mild, cartoon/fantasy violence** — a
  stylized dolphin rams stylized sharks and they vanish in a burst; no blood,
  no gore, no realistic injury, no humans.
- **Sexuality / nudity:** none.
- **Language:** none.
- **Controlled substances:** none.
- **Gambling:** none (the leaderboards are score-based, no wagering, no
  simulated gambling).
- **User interaction / user-generated content:** none — no chat, no sharing;
  the dolphin name is stored only on the device and not shared anywhere.
- **Data collection / location:** none (unless real AdMob IDs are set — then an
  advertising ID is collected; declare it).

Likely outcome: **PEGI 7 / ESRB Everyone 10+ / USK 6** or similar. Google will
assign the exact ratings from your answers.


App content declarations (Play Console → App content)
----------------------------------------------------
- **Ads:** **contains ads** (rewarded + interstitial via AdMob) once real ad IDs
  are set. With the default test IDs, answer per your test build.
- **In-app purchases:** **yes** — one consumable, `continue_run` (continue an
  Endless run). Price range is whatever you set in Play Console.
- **Target audience:** 13+ recommended (simplest path — avoids the extra
  "designed for families" requirements). The content itself is suitable for
  younger players if you choose to include them.
- **News app:** no.
- **COVID-19 contact tracing:** no.
- **Government app:** no.
- **Financial features:** none.


Release checklist
-----------------
1. Host `privacy-policy.md` somewhere public, get the URL.
2. Play Console → create app → "Sharks vs Dolphins", game, free, not ads.
3. Fill: store listing (copy above + graphics), Data safety, Content rating,
   App content declarations.
4. Testing → Internal testing → create release → upload
   `android/app/build/outputs/bundle/release/app-release.aab` → add your own
   Google account as a tester → install from the opt-in link on the Pixel.
5. Play through the internal build end to end.
6. Promote to Closed / Open / Production when satisfied.
