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
• Two leaderboards — fastest Campaign clear and deepest Endless run, with
  three-letter initials, all stored on your device.
• The Mega Pod finale — every dolphin you save across a Campaign run is banked,
  then called back all at once for the final push against the Matriarch.
• Magic Shrimp power-ups, procedural storms that cut your visibility, a sprint
  dash on a cooldown, achievements, and first-run tips that only show once.
• Procedurally synthesized sound effects and a dynamic ambient / boss
  soundtrack.

No ads. No in-app purchases. No account. No internet connection needed after
install — everything runs on your device.
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
- **Does your app collect or share any of the required user data types?** → **No**
- **Is all of the user data encrypted in transit?** → N/A (no data collected or transmitted)
- **Do you provide a way for users to request that their data be deleted?** →
  N/A; you may note that uninstalling or clearing storage removes all local data.
- **Data types collected:** none.
- **Data types shared:** none.

Rationale: the app has no analytics, ads, accounts, or network calls. The only
persisted data is local `localStorage` (scores, settings, achievements) which
never leaves the device — under Play's definitions this is not "collection".


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
- **User interaction / user-generated content:** none — no chat, no sharing,
  the "initials" are three local characters not shared anywhere.
- **Data collection / location:** none.

Likely outcome: **PEGI 7 / ESRB Everyone 10+ / USK 6** or similar. Google will
assign the exact ratings from your answers.


App content declarations (Play Console → App content)
----------------------------------------------------
- **Ads:** contains no ads.
- **In-app purchases:** none.
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
