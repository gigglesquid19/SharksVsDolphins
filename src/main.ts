import './style.css';
import { setupSharkopedia } from './sharkopediaView';
import { Game } from './game';
import { sfx } from './sfx';
import { clearRunCheckpoint, loadRunCheckpoint } from './runState';
import { getDolphinName, hasNamedDolphin, setDolphinName } from './profile';
import { nextTrackIn, trackTitle } from './music';
import { CANVAS_H, CANVAS_W } from './constants';
import { getPearls } from './pearls';
import { developerModeActive, grantHalfUpgrades, halfUpgradeLevel, setDeveloperMode } from './store';
import { bindSecretTaps, secretTapGesture } from './utils';
import { DAILY_REWARDS, claimDailyReward, dailyRewardAvailable, nextStreakDay } from './dailyReward';
import type { ConsumableId, Inventory } from './inventory';
import { CONSUMABLE_ORDER, CONSUMABLES } from './inventory';
import { setupStore } from './storeView';
import { setupDolphinView } from './dolphinView';
import { setupLevelSelect } from './levelSelectView';
import { ads } from './ads';
import { iap } from './iap';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

/** Element-id stem for each consumable's HUD button, count badge and wrapper. */
const SHRIMP_ELEMENT_ID: Record<ConsumableId, string> = {
  magicShrimp: 'shrimp',
  ghostShrimp: 'ghostShrimp',
  pistolShrimp: 'pistolShrimp',
};

/** Keyboard shortcut -> consumable, built from the same table the Store quotes to the player. */
const SHRIMP_KEYS: Record<string, ConsumableId> = Object.fromEntries(
  CONSUMABLE_ORDER.map((id) => [CONSUMABLES[id].key.toLowerCase(), id]),
);

// Android WebView's console bridge only relays file/line/message for uncaught errors and
// promise rejections (no stack) - re-log through console.error, which it relays in full,
// so crashes are diagnosable from `adb logcat` alone. Also surface the first error on-screen:
// mobile browsers have no console, and a silent throw looks exactly like "the game froze".
function showFatal(label: string, detail: unknown): void {
  console.error(label, detail);
  let el = document.getElementById('fatalError');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'fatalError';
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:9999;margin:0;padding:10px 12px;max-height:45vh;overflow:auto;' +
      'background:#7f1d1d;color:#fff;font:12px/1.4 monospace;white-space:pre-wrap;word-break:break-word;border-top:2px solid #fca5a5';
    document.body.appendChild(el);
  }
  el.textContent = `${label}\n${String(
    (detail as { stack?: string })?.stack || (detail as { message?: string })?.message || detail,
  )}`;
}
window.addEventListener('error', (event) => showFatal('[onerror]', event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showFatal('[unhandledrejection]', event.reason));

/**
 * Registers the Workbox service worker (see vite.config.ts) so the built assets are cached for
 * offline play, and offers the update when a new deploy lands.
 *
 * registerType is 'prompt' for a good reason - swapping JS chunks under a running game breaks it,
 * because every deploy deletes the old hashed chunks from Pages and the live page starts asking
 * for files that now 404. What was missing is the other half of 'prompt': something to prompt
 * with. Passing no onNeedRefresh left the new worker waiting indefinitely, and a waiting worker
 * does not take over on a reload - it waits for every tab on the origin to close, which on a
 * desktop browser can be a very long time and is not something a reload or a hard-refresh does.
 * The effect was players sitting on a build from several deploys ago with no way to know.
 *
 * updateSW(true) skips the wait and reloads in one go, so the page comes back on a complete,
 * consistent asset set rather than a half-swapped one - which is exactly what the old comment
 * was trying to avoid.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.innerHTML = '<span>A new version is ready.</span>';
    const btn = document.createElement('button');
    btn.textContent = 'Reload';
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Updating…';
      void updateSW(true);
    });
    const later = document.createElement('button');
    later.className = 'update-bar-dismiss';
    later.textContent = 'Later';
    later.setAttribute('aria-label', 'Dismiss the update notice');
    later.addEventListener('click', () => bar.remove());
    bar.append(btn, later);
    document.body.appendChild(bar);
  },
});

// Which build this actually is, where a tester can read it out. See __BUILD_STAMP__ in
// vite-env.d.ts for why that is worth a line on the title screen.
const titleBuildEl = document.getElementById('titleBuild');
if (titleBuildEl) titleBuildEl.textContent = `build ${__BUILD_STAMP__} UTC`;

const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
const canvasWrap = document.getElementById('canvasWrap') as HTMLDivElement;

// The HUD badges (level, dolphins saved, pearls) and the achievement toast are positioned
// against .canvas-wrap, whose first child is the controls row - without this they render on
// top of the buttons and can completely hide Start, which looks exactly like a frozen game.
// Publish the controls' height as --stage-top so they anchor below it (see style.css); the
// row wraps to 2-3 lines depending on window width, so it must be measured, not hard-coded.
// Module scope, not inside main(), so the observers are live before `await game.init()`.
const controlsRow = document.querySelector('.canvas-wrap .game-controls') as HTMLElement | null;
function syncStageTop(): void {
  if (!controlsRow) return;
  // Compact/fullscreen centres a square canvas in a full-height wrap, so the wrap's top edge is
  // nowhere near the water: anchoring the badges there put them up in the empty band above the
  // play area and straight through the floating control bar. Measure the canvas itself instead,
  // and the badges sit on the water's top corners wherever the canvas has ended up.
  const compact = !!document.fullscreenElement || canvasWrap.classList.contains('compact');
  const canvas = canvasWrap.querySelector('canvas');
  const anchor = compact && canvas ? canvas : controlsRow;
  const wrapTop = canvasWrap.getBoundingClientRect().top;
  const rect = anchor.getBoundingClientRect();
  const offset = compact ? rect.top - wrapTop : rect.bottom - wrapTop;
  canvasWrap.style.setProperty('--stage-top', `${Math.max(0, Math.round(offset))}px`);
}

const titleScreen = document.getElementById('titleScreen') as HTMLDivElement;
const narrativeScreen = document.getElementById('narrativeScreen') as HTMLDivElement;
const appContent = document.getElementById('appContent') as HTMLDivElement;

if (controlsRow && 'ResizeObserver' in window) {
  const ro = new ResizeObserver(syncStageTop);
  ro.observe(controlsRow);
  ro.observe(canvasWrap);
}
window.addEventListener('resize', syncStageTop);
// .canvas-wrap has no box until #appContent is revealed, so measure again on that transition.
new MutationObserver(() => requestAnimationFrame(syncStageTop)).observe(appContent, {
  attributes: true,
  attributeFilter: ['class'],
});
syncStageTop();

const bgMusic = document.getElementById('bgMusic') as HTMLAudioElement;
const muteBtn = document.getElementById('muteBtn') as HTMLButtonElement;
const volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
const MUSIC_MUTED_KEY = 'svsd-music-muted';
/** How far the music drops while a sting plays, as a fraction of the player's chosen volume. */
const MUSIC_DUCK_LEVEL = 0.3;
let duckTimer: number | null = null;
const VOLUME_KEY = 'svsd-volume';

/** The volume the player has chosen, 0-1. Read fresh every time, never cached, so moving the
 *  slider during a duck or after a game over still lands where they left it. */
function chosenMusicVolume(): number {
  return Math.min(1, Math.max(0, Number(volumeSlider.value) / 100));
}

function applyVolume(value: number): void {
  const normalized = Math.min(100, Math.max(0, value)) / 100;
  bgMusic.volume = normalized;
  sfx.setVolume(normalized);
}

const savedVolume = localStorage.getItem(VOLUME_KEY);
const initialVolume = savedVolume !== null ? Number(savedVolume) : 35;
volumeSlider.value = String(initialVolume);
applyVolume(initialVolume);

bgMusic.muted = localStorage.getItem(MUSIC_MUTED_KEY) === 'true';
muteBtn.textContent = bgMusic.muted ? 'Music: Off' : 'Music: On';
sfx.setMuted(bgMusic.muted);

// Skipping stays inside the current pool, so a boss fight never drops into ambient. The button
// briefly shows what it switched to, which is the only feedback available while muted.
const nextTrackBtn = document.getElementById('nextTrackBtn') as HTMLButtonElement;
const NEXT_TRACK_LABEL = '\u266B Next Song';
let nextTrackLabelTimer: number | null = null;

nextTrackBtn.addEventListener('click', () => {
  const next = nextTrackIn(bgMusic.currentSrc || bgMusic.src);
  bgMusic.src = next;
  bgMusic.load();
  bgMusic.play().catch((err) => console.warn('Music track switch failed:', err));

  const title = trackTitle(next);
  nextTrackBtn.textContent = title;
  nextTrackBtn.setAttribute('aria-label', `Now playing ${title}. Play the next song`);
  if (nextTrackLabelTimer !== null) window.clearTimeout(nextTrackLabelTimer);
  nextTrackLabelTimer = window.setTimeout(() => {
    nextTrackBtn.textContent = NEXT_TRACK_LABEL;
    nextTrackLabelTimer = null;
  }, 1800);
});

muteBtn.addEventListener('click', () => {
  bgMusic.muted = !bgMusic.muted;
  muteBtn.textContent = bgMusic.muted ? 'Music: Off' : 'Music: On';
  localStorage.setItem(MUSIC_MUTED_KEY, String(bgMusic.muted));
  sfx.setMuted(bgMusic.muted);
});

volumeSlider.addEventListener('input', () => {
  const value = Number(volumeSlider.value);
  applyVolume(value);
  localStorage.setItem(VOLUME_KEY, String(value));

  const shouldMute = value === 0;
  if (shouldMute !== bgMusic.muted) {
    bgMusic.muted = shouldMute;
    muteBtn.textContent = shouldMute ? 'Music: Off' : 'Music: On';
    localStorage.setItem(MUSIC_MUTED_KEY, String(shouldMute));
    sfx.setMuted(shouldMute);
  }
});

const titleContinueBtn = document.getElementById('titleContinueBtn') as HTMLButtonElement;
const savedCheckpoint = loadRunCheckpoint();

// --- Dolphin name ---
const narrativeNameEl = document.getElementById('narrativeName') as HTMLElement;
const dolphinNameField = document.getElementById('dolphinNameField') as HTMLLabelElement;
const dolphinNameInput = document.getElementById('dolphinNameInput') as HTMLInputElement;
const pauseNameInput = document.getElementById('pauseNameInput') as HTMLInputElement;

function refreshDolphinName(): void {
  const name = getDolphinName();
  narrativeNameEl.textContent = name;
  dolphinNameInput.value = name;
  pauseNameInput.value = name;
}
refreshDolphinName();
// Only prompt on the narrative screen the first time; after that it's the pause menu.
dolphinNameField.classList.toggle('hidden', hasNamedDolphin());

dolphinNameInput.addEventListener('change', () => {
  setDolphinName(dolphinNameInput.value);
  refreshDolphinName();
});
pauseNameInput.addEventListener('change', () => {
  setDolphinName(pauseNameInput.value);
  refreshDolphinName();
});

if (savedCheckpoint) titleContinueBtn.classList.remove('hidden');

// --- Splash screen ---
// Shown first on load: the logo big with a "press anything" prompt. Any key or tap reveals
// the title screen. A capture-phase key listener so the very first press only dismisses the
// splash (and never leaks through to the game's pause/movement handlers).
const splashScreen = document.getElementById('splashScreen') as HTMLDivElement;
const splashLogo = document.getElementById('splashLogo') as HTMLImageElement;
splashLogo.src = `${import.meta.env.BASE_URL}splash-art.webp`;
let splashDismissed = false;

function dismissSplash(): void {
  if (splashDismissed) return;
  splashDismissed = true;
  splashScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  // Offered here rather than on the splash, so the first thing a player sees is the game's own
  // art and not a reward prompt. Nothing appears at all once the day's reward is taken.
  maybeShowDailyReward();
}

window.addEventListener(
  'keydown',
  (e) => {
    if (splashDismissed) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    dismissSplash();
  },
  true,
);
// `click`, not `pointerdown`, so hiding the splash mid-tap can't let the release land on a
// title-screen button underneath.
splashScreen.addEventListener('click', dismissSplash);

// --- Pearls ---
// The <img class="pearl-icon"> tags ship with a placeholder "/pearl.png"; rewrite them to the
// deploy base so they resolve under the GitHub Pages sub-path (mirrors ASSET_BASE in game.ts).
document.querySelectorAll<HTMLImageElement>('img.pearl-icon').forEach((img) => {
  img.src = `${import.meta.env.BASE_URL}pearl.png`;
});
const titlePearlsNumberEl = document.getElementById('titlePearlsNumber');
function refreshTitlePearls(): void {
  if (titlePearlsNumberEl) titlePearlsNumberEl.textContent = String(getPearls());
}

// ---------------------------------------------------------------- daily reward
const dailyOverlay = document.getElementById('dailyRewardOverlay') as HTMLDivElement | null;
const dailyStripEl = document.getElementById('dailyStrip') as HTMLDivElement | null;
const dailyTextEl = document.getElementById('dailyRewardText') as HTMLElement | null;
const dailyClaimBtn = document.getElementById('dailyClaimBtn') as HTMLButtonElement | null;

/**
 * Paints the seven-day strip. `today` is the day a claim would land on; anything before it in
 * the current streak is already banked, so it is ticked rather than lit.
 */
function renderDailyStrip(today: number, claimedToday: boolean): void {
  if (!dailyStripEl) return;
  dailyStripEl.innerHTML = DAILY_REWARDS.map((pearls, i) => {
    const day = i + 1;
    const banked = day < today || (day === today && claimedToday);
    const isToday = day === today && !claimedToday;
    const classes = ['daily-day'];
    if (banked) classes.push('claimed');
    if (isToday) classes.push('today');
    return `<div class="${classes.join(' ')}">
        <div class="daily-day-label">Day ${day}</div>
        <div class="daily-day-value">${banked ? '✓' : pearls}</div>
      </div>`;
  }).join('');
}

function refreshDailyCard(): void {
  const day = nextStreakDay();
  const available = dailyRewardAvailable();
  renderDailyStrip(day, !available);
  if (dailyTextEl) {
    dailyTextEl.textContent = available
      ? `Day ${day} of your streak. Come back tomorrow for more.`
      : `Day ${day} claimed. Come back tomorrow to keep the streak.`;
  }
  if (dailyClaimBtn) {
    dailyClaimBtn.textContent = available ? `Claim ${DAILY_REWARDS[day - 1]} Pearls` : 'Claimed today';
    dailyClaimBtn.disabled = !available;
  }
}

/** Shown once per launch, and only when there is something to take. */
function maybeShowDailyReward(): void {
  if (!dailyOverlay || !dailyRewardAvailable()) return;
  refreshDailyCard();
  dailyOverlay.classList.remove('hidden');
}

dailyClaimBtn?.addEventListener('click', () => {
  const claim = claimDailyReward();
  if (!claim.claimed) return;
  refreshTitlePearls();
  refreshDailyCard();
  sfx.resume();
  sfx.playAchievement();
});

document.getElementById('dailyCloseBtn')?.addEventListener('click', () => {
  dailyOverlay?.classList.add('hidden');
});
refreshTitlePearls();

// --- Store ---
const store = setupStore({ onPearlsChange: refreshTitlePearls });
document.getElementById('titleStoreBtn')!.addEventListener('click', () => store.open());

// "Your Dolphin" reads from the same storage the Store writes, so it is refreshed on every open
// rather than cached - a skin equipped or an upgrade bought a moment ago has to be reflected.
const dolphinView = setupDolphinView(() => store.open());
document.getElementById('titleDolphinBtn')!.addEventListener('click', () => dolphinView.show());

// --- Monetisation (Android only; both no-op on web) ---
void ads.init();
void iap.init();

// --- About Me ---
// TODO: replace with the real Buy Me a Coffee URL.
const COFFEE_URL = 'https://www.buymeacoffee.com/';
const aboutScreen = document.getElementById('aboutScreen') as HTMLDivElement;
(document.getElementById('aboutPhoto') as HTMLImageElement).src = `${import.meta.env.BASE_URL}about-me.webp`;
document.getElementById('titleAboutBtn')!.addEventListener('click', () => aboutScreen.classList.remove('hidden'));
document.getElementById('aboutBackBtn')!.addEventListener('click', () => aboutScreen.classList.add('hidden'));
document.getElementById('coffeeBtn')!.addEventListener('click', (e) => {
  // window.open with _blank is what Capacitor hands off to the system browser on Android.
  e.preventDefault();
  window.open(COFFEE_URL, '_blank', 'noopener');
});

/**
 * Leaves the title screen for the game.
 *
 * `narrative` decides whether the story panel is read on the way through. It is the Campaign's
 * own opening - Echo cut off from her pod, the Shallows to take back - so a dive launched from
 * Level Select skips it and goes straight to the water: that player is picking a bought depth
 * partway down, not starting the story.
 */
function enterAppFromTitle(narrative: boolean): void {
  titleScreen.classList.add('hidden');
  if (narrative) {
    narrativeScreen.classList.remove('hidden');
  } else {
    // Skipping the panel means doing the job its Continue button would have done on the way out.
    narrativeScreen.classList.add('hidden');
    appContent.classList.remove('hidden');
    syncStageTop();
  }
  bgMusic.play().catch((err) => console.warn('Music playback failed:', err));
  sfx.resume();
}

document.getElementById('narrativeContinueBtn')!.addEventListener('click', () => {
  setDolphinName(dolphinNameInput.value);
  refreshDolphinName();
  dolphinNameField.classList.add('hidden');
  narrativeScreen.classList.add('hidden');
  appContent.classList.remove('hidden');
  syncStageTop();
});

/**
 * Set by main() once the title-screen helpers exist. `inputs` is built at module scope and handed
 * to the Game constructor before those are defined, so the callback has to reach them through a
 * variable rather than closing over them directly.
 */
let returnToTitleHandler: (() => void) | null = null;

const inputs = {
  sharkSpeed: document.getElementById('sharkSpeed') as HTMLInputElement,
  speed: document.getElementById('speed') as HTMLInputElement,
  startBtn: document.getElementById('startBtn') as HTMLButtonElement,
  statTime: document.getElementById('statTime') as HTMLElement,
  statSpawn: document.getElementById('statSpawn') as HTMLElement,
  statShrimp: document.getElementById('statShrimp') as HTMLElement,
  statDolphins: document.getElementById('statDolphins') as HTMLElement,
  statSharks: document.getElementById('statSharks') as HTMLElement,
  statStatus: document.getElementById('statStatus') as HTMLElement,
  sharkGuideList: document.getElementById('sharkGuideList') as HTMLElement,
  banner: document.getElementById('gameBanner') as HTMLDivElement,
  newWatersPrompt: document.getElementById('newWatersPrompt') as HTMLDivElement,
  pauseOverlay: document.getElementById('pauseOverlay') as HTMLDivElement,
  schoolBtnWrap: document.getElementById('schoolBtnWrap') as HTMLDivElement,
  levelUpOverlay: document.getElementById('levelUpOverlay') as HTMLDivElement,
  sharkWarningOverlay: document.getElementById('sharkWarningOverlay') as HTMLDivElement,
  sharkWarningList: document.getElementById('sharkWarningList') as HTMLDivElement,
  onSchoolingChange: (active: boolean) => {
    bgMusic.playbackRate = active ? 1.5 : 1;
  },
  onMusicTrackChange: (url: string) => {
    bgMusic.src = url;
    bgMusic.load();
    bgMusic.play().catch((err) => console.warn('Music track switch failed:', err));
  },
  // Dips the music under a sting, then brings it back. Reads the slider each time rather than
  // caching a level, so it still lands where the player left the volume if they move it mid-duck,
  // and a second duck starting before the first has finished simply restarts the timer.
  // Echolocation is fired by double-tapping the water and its cooldown is drawn around the
  // dolphin, so there is no button left to show or hide. The callback stays because the game
  // still reports the ability coming and going, and a future control may want to know.
  onEchoAvailabilityChange: () => {},
  // A shrimp button only exists while there is one of that kind to spend, so an empty pack does
  // not leave dead controls on screen.
  onConsumableChange: (counts: Inventory) => {
    for (const id of CONSUMABLE_ORDER) {
      const held = counts[id];
      const count = document.getElementById(`${SHRIMP_ELEMENT_ID[id]}Count`);
      if (count) count.textContent = String(held);
      document.getElementById(`${SHRIMP_ELEMENT_ID[id]}BtnWrap`)?.classList.toggle('hidden', held <= 0);
    }
  },
  onMusicDuck: (durationMs: number) => {
    const restore = () => {
      bgMusic.volume = chosenMusicVolume();
      duckTimer = null;
    };
    if (duckTimer !== null) window.clearTimeout(duckTimer);
    bgMusic.volume = chosenMusicVolume() * MUSIC_DUCK_LEVEL;
    duckTimer = window.setTimeout(restore, durationMs);
  },
  // Game over: the music stops rather than dipping, and stays stopped. Any duck still running
  // is cancelled first - otherwise its timer would quietly restore the volume, and the next run
  // would be fine but a scrubbed playhead would not be.
  onMusicStop: () => {
    if (duckTimer !== null) {
      window.clearTimeout(duckTimer);
      duckTimer = null;
    }
    bgMusic.pause();
    // Back to the top, so the next run opens on the phrase rather than halfway through it.
    bgMusic.currentTime = 0;
    bgMusic.volume = chosenMusicVolume();
  },
  // The Campaign's last screen hands the player back to the title rather than to another level.
  onReturnToTitle: () => returnToTitleHandler?.(),
  onMusicResume: () => {
    if (!bgMusic.paused) return;
    bgMusic.volume = chosenMusicVolume();
    bgMusic.play().catch((err) => console.warn('Music resume failed:', err));
  },
};

(async function main() {
  const game = new Game(canvas, inputs);
  await game.init();
  const gameCanvas = game.getCanvas();

  inputs.startBtn.addEventListener('click', () => game.retry());

  // ?diag - an on-screen readout of the game loop state, for debugging a freeze on a
  // device with no console. Load <url>/?diag to enable it.
  if (new URLSearchParams(location.search).has('diag')) {
    const panel = document.createElement('pre');
    panel.style.cssText =
      'position:fixed;top:0;left:0;z-index:9998;margin:0;padding:6px 8px;background:rgba(2,6,23,.85);' +
      'color:#7dd3fc;font:11px/1.35 monospace;white-space:pre;pointer-events:none;max-width:60vw';
    document.body.appendChild(panel);
    setInterval(() => {
      try {
        panel.textContent = JSON.stringify(game.debugSnapshot(), null, 1);
      } catch (e) {
        panel.textContent = 'debugSnapshot threw:\n' + String((e as Error)?.stack || e);
      }
    }, 250);
  }

  // Each entry rebuilds the water for the mode it is entering, so the screen behind the Start
  // button is always the level about to be played rather than whatever was there before.
  document.getElementById('titleCampaignBtn')!.addEventListener('click', () => {
    clearRunCheckpoint();
    game.setMode('campaign');
    game.showSelectedLevel();
    enterAppFromTitle(true);
  });
  document.getElementById('titleEndlessBtn')!.addEventListener('click', () => {
    game.setMode('endless');
    game.showSelectedLevel();
    enterAppFromTitle(true);
  });

  // Level Select: the same entry as the button above, but starting at a bought depth. setMode is
  // called first because it resets the depth, and the chosen level is set after it.
  const depthSelect = setupLevelSelect({
    onPearlsChange: refreshTitlePearls,
    onDive: (level) => {
      game.setMode('endless');
      if (!game.setDepthlessStartLevel(level)) return;
      // Show that depth straight away rather than level 1 until Start is pressed.
      game.showSelectedLevel();
      depthSelect.close();
      enterAppFromTitle(false);
    },
  });
  document.getElementById('titleDepthSelectBtn')!.addEventListener('click', () => depthSelect.open());
  const sharkopedia = setupSharkopedia();
  document.getElementById('titleSharkopediaBtn')!.addEventListener('click', () => sharkopedia.open());
  titleContinueBtn.addEventListener('click', () => {
    // Re-read: a checkpoint may have been written this session (e.g. after an Android Game Over).
    const checkpoint = loadRunCheckpoint();
    if (!checkpoint) return;
    game.setMode('campaign');
    titleScreen.classList.add('hidden');
    narrativeScreen.classList.add('hidden');
    appContent.classList.remove('hidden');
    syncStageTop();
    bgMusic.play().catch((err) => console.warn('Music playback failed:', err));
    sfx.resume();
    game.resumeRun(checkpoint);
  });

  document.getElementById('leaderboardBtn')!.addEventListener('click', () => game.showLeaderboard());
  document.getElementById('achievementsBtn')!.addEventListener('click', () => game.showAchievements());
  document.getElementById('achievementsCloseBtn')!.addEventListener('click', () => game.hideAchievements());

  document.getElementById('runSummarySaveBtn')!.addEventListener('click', () => game.submitPendingScore());
  document.getElementById('runSummaryShareBtn')!.addEventListener('click', () => void game.shareCampaign());
  document.getElementById('runSummaryDoubleBtn')!.addEventListener('click', () => void game.doublePearlsViaAd());
  document.getElementById('runSummarySkipBtn')!.addEventListener('click', () => game.dismissRunSummary());
  document.getElementById('milestoneShareBtn')!.addEventListener('click', () => void game.shareEndless50());
  document.getElementById('milestoneContinueBtn')!.addEventListener('click', () => game.dismissMilestone());

  // Android Game Over: Continue offer + a way back to the menu (no Retry button on Android).
  /** Swaps the screens back to the title. Does not touch the run - callers decide that. */
  function showTitleScreen(): void {
    appContent.classList.add('hidden');
    narrativeScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
    // Toggled rather than only revealed: a campaign that has just been finished clears its
    // checkpoint, and this screen is now where that run ends, so a Continue left over from
    // earlier in the session would offer to resume a run that no longer exists.
    titleContinueBtn.classList.toggle('hidden', !loadRunCheckpoint());
    refreshTitlePearls();
  }

  function returnToTitle(): void {
    game.reset();
    showTitleScreen();
  }
  returnToTitleHandler = returnToTitle;
  document.getElementById('continueAdBtn')!.addEventListener('click', () => void game.continueViaAd());
  document.getElementById('continuePayBtn')!.addEventListener('click', () => void game.continueViaPurchase());
  document.getElementById('continueDeclineBtn')!.addEventListener('click', () => game.declineContinue());
  document.getElementById('runSummaryHomeBtn')!.addEventListener('click', () => {
    game.dismissRunSummary();
    returnToTitle();
  });
  document.getElementById('gameOverHomeBtn')!.addEventListener('click', returnToTitle);
  document.getElementById('schoolBtn')!.addEventListener('click', () => game.formSchool());
  document.getElementById('megaPodBtn')!.addEventListener('click', () => game.summonMegaPod());
  document.getElementById('megaShrimpYellow')!.addEventListener('click', () => game.chooseUpgrade('vitality'));
  document.getElementById('megaShrimpRed')!.addEventListener('click', () => game.chooseUpgrade('speed'));
  document.getElementById('megaShrimpBlue')!.addEventListener('click', () => game.chooseUpgrade('charisma'));
  document.getElementById('megaShrimpGreen')!.addEventListener('click', () => game.chooseUpgrade('boost'));
  document.getElementById('sharkWarningContinueBtn')!.addEventListener('click', () => game.dismissSharkWarning());
  document.getElementById('tutorialHintContinueBtn')!.addEventListener('click', () => game.dismissTutorialHint());
  // The whole dialogue box is the tap target, not a button inside it - there is nothing else to
  // tap on the Matriarch's defeat screen.
  document.getElementById('matriarchDialogue')!.addEventListener('click', () => game.advanceMatriarchDialogue());
  document.getElementById('leaderboardCloseBtn')!.addEventListener('click', () => game.hideLeaderboard());
  document.getElementById('resetBtn')!.addEventListener('click', () => game.reset());
  document.getElementById('fullscreenBtn')!.addEventListener('click', toggleFullscreen);

  /**
   * The same seven-tap testing gesture as the one on Level Select, on the pause panel's Pearl
   * balance. Two places because those are the two screens showing a Pearl count, and a cheat is
   * no use if it has to be remembered which of them carries it - the pause panel is the one
   * reachable mid-run, which is where the want for a stronger build actually comes up.
   *
   * Bound to the whole row rather than the number, which is a few pixels wide on a phone.
   */
  /**
   * Puts the developer-mode gesture on a Pearl display.
   *
   * Two Pearl displays carry it: this one, on the pause panel, and Level Select's, which has its
   * own notice and so binds the gesture itself. The title screen's and the Store's deliberately
   * do not - those are places a player is reading a balance rather than setting up a test.
   */
  function installDeveloperModeTaps(el: HTMLElement): void {
    let note: HTMLParagraphElement | null = null;
    let noteTimer = 0;
    bindSecretTaps(
      el,
      secretTapGesture(
        7,
        2500,
        () => {
          const turningOn = !developerModeActive();
          setDeveloperMode(turningOn);
          const raised = turningOn ? grantHalfUpgrades() : 0;
          const half = halfUpgradeLevel();
          if (!note) {
            note = document.createElement('p');
            note.className = 'pause-cheat-note';
            el.insertAdjacentElement('afterend', note);
          }
          note.textContent = turningOn
            ? `Developer mode on: every upgrade at level ${half}` +
              (raised > 0 ? ` (${raised} granted)` : ' already') +
              ', a dolphin every 10s. Restart the level to feel the new pace.'
            : 'Developer mode off. Dolphins back to their usual pace; the upgrades are yours to keep.';
          window.clearTimeout(noteTimer);
          noteTimer = window.setTimeout(() => {
            note?.remove();
            note = null;
          }, 3000);
        },
        // Counts up from partway in, so a run of taps that is landing looks different from one
        // that is not - the only way to tell, otherwise, is whether the seventh does anything.
        (count, needed) => {
          if (count < 3) return;
          el.style.opacity = String(1 - 0.12 * (needed - count));
          window.setTimeout(() => { el.style.opacity = ''; }, 2600);
        },
      ),
    );
  }

  const pausePearlsRow = document.querySelector('.pause-pearls') as HTMLElement | null;
  // The note is inserted after the row rather than written into it: rewriting the row would
  // replace #pearlsNumber, which game.ts looks up once at startup, and the balance would quietly
  // stop updating from the first use of the cheat onwards.
  if (pausePearlsRow) installDeveloperModeTaps(pausePearlsRow);

  document.getElementById('pauseBtn')!.addEventListener('click', () => game.togglePause());
  document.getElementById('pauseResumeBtn')!.addEventListener('click', () => game.togglePause());
  document.getElementById('pauseRestartBtn')!.addEventListener('click', () => game.retry());
  // Opened over the pause overlay rather than replacing it, so closing the panel puts the player
  // back on Paused where they were rather than dropping them into a running game.
  document.getElementById('pauseDolphinBtn')!.addEventListener('click', () => dolphinView.show(game.runUpgrades()));
  document.getElementById('pauseResetBtn')!.addEventListener('click', () => game.reset());
  // Quitting mid-run was only reachable from the Android Game Over screen before, so a paused
  // player had no way back to the menu at all - on Android there is no browser chrome to fall
  // back on. leaveToMenu() keeps the campaign checkpoint, so Continue Campaign still works.
  document.getElementById('pauseHomeBtn')!.addEventListener('click', () => {
    game.leaveToMenu();
    showTitleScreen();
  });

  const SCROLLING_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      game.togglePause();
      return;
    }
    // Echolocation fires on the press rather than being polled like Space: it is a one-shot
    // ability on a cooldown, so holding the key must not queue anything up.
    if ((e.key === 'e' || e.key === 'E') && !e.repeat) {
      fireEcho();
      return;
    }
    // Same for the shrimp - holding a key must not burn the whole pack.
    if (!e.repeat) {
      const shrimpKey = SHRIMP_KEYS[e.key.toLowerCase()];
      if (shrimpKey) {
        useShrimp(shrimpKey);
        return;
      }
    }
    // Arrow keys scroll the page by default; that's what made the window "slide" during play.
    if (SCROLLING_KEYS.has(e.key)) {
      e.preventDefault();
    }
    game.setKey(e.key, true);
    if (e.code === 'Space') {
      e.preventDefault();
      game.setKey(' ', true);
    }
  });
  window.addEventListener('keyup', (e) => {
    game.setKey(e.key, false);
    if (e.code === 'Space') game.setKey(' ', false);
  });

  function toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      canvasWrap.requestFullscreen().catch((err) => console.warn('Fullscreen failed:', err));
    } else {
      document.exitFullscreen();
    }
  }

  // True browser Fullscreen API (desktop/mobile web) OR the native app's always-on compact
  // layout (see enableNativeCompactLayout - Android WebView doesn't reliably support
  // Element.requestFullscreen() for arbitrary elements, so the native app can't rely on it).
  function isCompactLayout(): boolean {
    return !!document.fullscreenElement || canvasWrap.classList.contains('compact');
  }

  function applyFullscreenCanvasSize(): void {
    if (isCompactLayout()) {
      // The top control bar floats fixed over the canvas in this layout; reserve real space
      // for it (measured, since it can wrap onto two rows on a narrower window) so gameplay
      // near the top edge is never hidden behind it.
      const controlsEl = document.querySelector('.canvas-wrap .game-controls') as HTMLElement | null;
      const gap = 12;
      const reservedTop = controlsEl ? controlsEl.getBoundingClientRect().bottom + gap : 0;
      canvasWrap.style.paddingTop = `${reservedTop}px`;

      // The largest box of the arena's own shape that fits both budgets. The proportions are never
      // touched - filling width and height independently would stretch the world, drawing circular
      // things as ellipses and making vertical distances read differently from horizontal ones.
      // WIDTH_FILL/HEIGHT_FILL leave breathing room rather than going fully edge to edge; the
      // height budget is what keeps the fixed d-pad row clear of the play area.
      const WIDTH_FILL = 0.99;
      const HEIGHT_FILL = 0.88;
      const ratio = CANVAS_W / CANVAS_H;
      const availableHeight = window.innerHeight - reservedTop;
      let width = Math.max(1, window.innerWidth * WIDTH_FILL);
      const maxHeight = Math.max(1, availableHeight * HEIGHT_FILL);
      if (width / ratio > maxHeight) width = maxHeight * ratio;
      gameCanvas.style.width = `${width}px`;
      gameCanvas.style.height = `${width / ratio}px`;
      // The badges hang off the canvas's top edge in this layout, which has just moved.
      syncStageTop();
    } else {
      canvasWrap.style.paddingTop = '';
      // Clear the sizes Pixi writes inline (autoDensity) as well as anything the compact layout
      // left behind, so the stylesheet's `canvas { width: 100%; height: auto }` takes over and
      // the stage fills the panel. Pixi pins the canvas to its 600px backing-store size, which
      // beats the stylesheet and left a strip of dead panel down the right-hand side.
      gameCanvas.style.width = '';
      gameCanvas.style.height = '';
    }
  }

  // The bar above the water is for the things a player reaches for mid-game; everything else
  // lives in the pause menu, which is where you already are when you want it. The leaderboard, the
  // achievements and the music controls are never urgent, so they move there for good and the bar
  // is left short enough to read at a glance.
  const PAUSE_MENU_CONTROL_IDS = ['leaderboardBtn', 'achievementsBtn', 'muteBtn', 'nextTrackBtn', 'volumeControl'];
  // In fullscreen, only Start/Retry + Pause can stay: the Fullscreen toggle itself joins the rest
  // in the pause panel so the bar is one row, and comes back on the way out.
  const FULLSCREEN_CONTROL_IDS = ['fullscreenBtn'];
  let relocatedControls: { el: HTMLElement; parent: HTMLElement; nextSibling: Node | null }[] = [];

  /** Moves the named controls into the pause panel, remembering where each came from. */
  function relocateControls(ids: string[]): void {
    const target = document.getElementById('pauseSettingsList');
    if (!target) return;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el || !el.parentElement || el.parentElement === target) continue;
      relocatedControls.push({ el, parent: el.parentElement, nextSibling: el.nextSibling });
      target.appendChild(el);
    }
  }

  /** Puts the named controls back where they were, leaving any others where they are. */
  function restoreControls(ids: string[]): void {
    relocatedControls = relocatedControls.filter(({ el, parent, nextSibling }) => {
      if (!ids.includes(el.id)) return true;
      parent.insertBefore(el, nextSibling);
      return false;
    });
  }

  function moveControlsIntoPauseMenu(): void {
    relocateControls(FULLSCREEN_CONTROL_IDS);
  }

  function restoreControlsFromPauseMenu(): void {
    restoreControls(FULLSCREEN_CONTROL_IDS);
  }

  relocateControls(PAUSE_MENU_CONTROL_IDS);

  // The native Android/iOS app has no browser chrome to escape and always fills the screen,
  // so it gets the compact layout permanently rather than through the (unreliable, in a
  // WebView) Fullscreen API. The Fullscreen toggle itself is meaningless there, so it's
  // hidden rather than relocated.
  function enableNativeCompactLayout(): void {
    canvasWrap.classList.add('compact');
    document.getElementById('fullscreenBtn')?.classList.add('hidden');
    moveControlsIntoPauseMenu();
    applyFullscreenCanvasSize();
    syncStageTop();
  }

  document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreenBtn') as HTMLButtonElement;
    btn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    if (document.fullscreenElement) {
      moveControlsIntoPauseMenu();
    } else {
      restoreControlsFromPauseMenu();
    }
    applyFullscreenCanvasSize();
    syncStageTop();
  });

  // Unconditional: the normal-layout branch is what clears Pixi's inline sizing, so it has to
  // run on load and on every resize, not only while a compact layout is active.
  window.addEventListener('resize', applyFullscreenCanvasSize);
  applyFullscreenCanvasSize();

  if (Capacitor.isNativePlatform()) {
    enableNativeCompactLayout();
  }

  const joystickBase = document.getElementById('joystickBase') as HTMLDivElement;
  const joystickThumb = document.getElementById('joystickThumb') as HTMLDivElement;

  const JOYSTICK_RADIUS = 52;
  let joystickActive = false;

  function moveJoystickThumb(dx: number, dy: number): void {
    joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function handleJoystickMove(clientX: number, clientY: number): void {
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > JOYSTICK_RADIUS) {
      const ratio = JOYSTICK_RADIUS / dist;
      dx *= ratio;
      dy *= ratio;
    }
    moveJoystickThumb(dx, dy);
    game.setPointer(true, dx / JOYSTICK_RADIUS, dy / JOYSTICK_RADIUS);
  }

  function endJoystick(): void {
    joystickActive = false;
    joystickBase.classList.remove('active');
    moveJoystickThumb(0, 0);
    // Mirror of the water's release: hand steering back rather than cancelling it outright, in
    // case a finger is still holding a direction on the water itself.
    if (waterSteerTouchId === null) game.setPointer(false);
  }

  /**
   * The touch driving the stick, by identifier.
   *
   * These handlers used to read `e.touches[0]`, which is not this element's touch - it is the
   * first touch anywhere on the document. With a thumb on the stick and a second thumb tapping
   * the water, both handlers were reading whichever finger happened to land first, so the stick
   * followed the tap and the tap was measured at the stick. Tracking the identifier is what lets
   * the two work at once.
   */
  let joystickTouchId: number | null = null;

  function findTouch(list: TouchList, id: number): Touch | null {
    for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
    return null;
  }

  joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joystickTouchId !== null) return; // already steering; ignore a second finger on the stick
    const touch = e.changedTouches[0];
    if (!touch) return;
    joystickTouchId = touch.identifier;
    joystickActive = true;
    joystickBase.classList.add('active');
    handleJoystickMove(touch.clientX, touch.clientY);
  }, { passive: false });

  joystickBase.addEventListener('touchmove', (e) => {
    if (joystickTouchId === null) return;
    const touch = findTouch(e.changedTouches, joystickTouchId);
    if (!touch) return;
    e.preventDefault();
    handleJoystickMove(touch.clientX, touch.clientY);
  }, { passive: false });

  function releaseJoystickTouch(e: TouchEvent): void {
    if (joystickTouchId === null) return;
    if (!findTouch(e.changedTouches, joystickTouchId)) return; // some other finger lifted
    e.preventDefault();
    joystickTouchId = null;
    endJoystick();
  }

  joystickBase.addEventListener('touchend', releaseJoystickTouch, { passive: false });
  joystickBase.addEventListener('touchcancel', releaseJoystickTouch, { passive: false });

  joystickBase.addEventListener('mousedown', (e) => {
    joystickActive = true;
    joystickBase.classList.add('active');
    handleJoystickMove(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    if (joystickActive) handleJoystickMove(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (joystickActive) endJoystick();
  });

  const sprintBtn = document.getElementById('sprintBtn') as HTMLButtonElement;

  function pressSprint(): void {
    sprintBtn.classList.add('active');
    game.setKey(' ', true);
  }
  function releaseSprint(): void {
    sprintBtn.classList.remove('active');
    game.setKey(' ', false);
  }

  sprintBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    pressSprint();
  }, { passive: false });
  sprintBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    releaseSprint();
  }, { passive: false });
  sprintBtn.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    releaseSprint();
  }, { passive: false });
  sprintBtn.addEventListener('mousedown', () => pressSprint());
  sprintBtn.addEventListener('mouseup', () => releaseSprint());
  sprintBtn.addEventListener('mouseleave', () => releaseSprint());

  const sprintCooldownRing = document.getElementById('sprintCooldownRing') as HTMLDivElement;
  let sprintWasReady = true;

  // One handler per kind, built from the same table the Store renders from, so adding a fourth
  // shrimp later means adding a row and a button rather than another copy of this block.
  function useShrimp(id: ConsumableId): void {
    const btn = document.getElementById(`${SHRIMP_ELEMENT_ID[id]}Btn`) as HTMLButtonElement | null;
    if (!game.useConsumableItem(id)) return;
    btn?.classList.add('active');
    window.setTimeout(() => btn?.classList.remove('active'), 200);
    inputs.onConsumableChange?.(game.consumableCounts());
  }

  for (const id of CONSUMABLE_ORDER) {
    const btn = document.getElementById(`${SHRIMP_ELEMENT_ID[id]}Btn`) as HTMLButtonElement | null;
    if (!btn) continue;
    btn.addEventListener('click', () => useShrimp(id));
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      useShrimp(id);
    });
  }

  const echoBtn = document.getElementById('echoBtn') as HTMLButtonElement;
  const echoCooldownRing = document.getElementById('echoCooldownRing') as HTMLDivElement;
  let echoWasReady = true;

  function fireEcho(): void {
    if (!game.echolocate()) return;
    echoBtn.classList.add('active');
    window.setTimeout(() => echoBtn.classList.remove('active'), 200);
  }

  echoBtn.addEventListener('click', fireEcho);
  echoBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    fireEcho();
  });

  function updateEchoCooldownVisual(): void {
    const fraction = game.getEchoCooldownFraction();
    echoCooldownRing.style.setProperty('--remaining', String(1 - fraction));
    const isReady = fraction >= 1;
    if (isReady && !echoWasReady && game.hasEcholocation()) {
      echoBtn.classList.add('ready-flash');
      setTimeout(() => echoBtn.classList.remove('ready-flash'), 500);
    }
    echoWasReady = isReady;
    requestAnimationFrame(updateEchoCooldownVisual);
  }
  requestAnimationFrame(updateEchoCooldownVisual);

  function updateSprintCooldownVisual(): void {
    const fraction = game.getSprintCooldownFraction();
    sprintCooldownRing.style.setProperty('--remaining', String(1 - fraction));
    const isReady = fraction >= 1;
    if (isReady && !sprintWasReady) {
      sprintBtn.classList.add('ready-flash');
      setTimeout(() => sprintBtn.classList.remove('ready-flash'), 500);
    }
    sprintWasReady = isReady;
    requestAnimationFrame(updateSprintCooldownVisual);
  }
  requestAnimationFrame(updateSprintCooldownVisual);

  function updatePointerDirection(clientX: number, clientY: number): void {
    const rect = gameCanvas.getBoundingClientRect();
    // Offset from the canvas centre in world proportions (~[-0.5, 0.5] per axis). Divide by
    // the deflection that should mean "full speed" (~45% of the way to the edge) so the
    // magnitude matches the joystick's 0..1 convention; movePlayer() clamps anything past 1.
    const REACH = 0.45;
    game.setPointer(
      true,
      ((clientX - rect.left) / rect.width - 0.5) / REACH,
      ((clientY - rect.top) / rect.height - 0.5) / REACH,
    );
  }

  /**
   * Abilities from the water itself: a tap in the middle of the screen is Boost, two taps are
   * Echolocation. Holding still steers, as it always did.
   *
   * The middle is the one part of the water where a press means nothing - steering is measured
   * from the centre outwards, so a touch there asks for no direction at all. That makes it free to
   * carry the abilities, and it is a target a thumb can find without looking, which is the whole
   * point: nobody should be hunting for a small button while a shark closes on them.
   */
  /**
   * How long a press can last and still count as a tap.
   *
   * Was 260ms, which is about how long a deliberate tap takes when you are calm and looking at
   * your thumb. With a shark closing it is longer than that, and every press that ran over simply
   * did nothing - no boost, no feedback, nothing to tell the player the game had decided they
   * were steering. Half a second is past what anyone taps in a hurry while still being far short
   * of a press-and-hold.
   */
  const TAP_MAX_MS = 550;
  /**
   * How far the finger can travel and still count as a tap rather than a steer.
   *
   * 16px is less than a thumb rolls on its own pad without meaning to, on a screen where the
   * whole arena is about 350px across.
   */
  const TAP_SLOP_PX = 30;
  /**
   * How long after one tap a second one reads as a double tap (Echolocation) rather than another
   * Boost. Must stay under BOOST_UNDO_WINDOW_MS in game.ts, which is what takes the first tap's
   * boost back - past that window the player pays for a boost and gets a ping as well.
   */
  const DOUBLE_TAP_MS = 420;
  /**
   * The tap target in the middle of the water, as a fraction of the canvas per axis - so it is an
   * ellipse the shape of the arena rather than a circle, covering this much of the width and the
   * same of the height.
   *
   * Raised from 0.22, which is roughly double the area. Nothing draws this zone, so a player
   * aiming for "the middle" is aiming at something they cannot see, and the cost of missing it
   * was an ability that silently failed. Quick taps out at this radius were only ever a flick of
   * steering that the hold-to-swim controls do better anyway.
   */
  const TAP_ZONE = 0.30;

  let tapStartAt = 0;
  let tapStartX = 0;
  let tapStartY = 0;
  let tapMoved = false;
  let lastTapAt = 0;

  function inTapZone(clientX: number, clientY: number): boolean {
    const rect = gameCanvas.getBoundingClientRect();
    const dx = (clientX - rect.left) / rect.width - 0.5;
    const dy = (clientY - rect.top) / rect.height - 0.5;
    return Math.hypot(dx, dy) <= TAP_ZONE;
  }

  function beginTap(clientX: number, clientY: number): void {
    tapStartAt = Date.now();
    tapStartX = clientX;
    tapStartY = clientY;
    tapMoved = false;
  }

  function trackTap(clientX: number, clientY: number): void {
    if (Math.hypot(clientX - tapStartX, clientY - tapStartY) > TAP_SLOP_PX) tapMoved = true;
  }

  /** Called on release. Fires an ability only if the press was a tap in the middle, not a steer. */
  function endTap(): void {
    const startedAt = tapStartAt;
    tapStartAt = 0;
    if (!startedAt || tapMoved) return;
    const now = Date.now();
    if (now - startedAt > TAP_MAX_MS) return;
    if (!inTapZone(tapStartX, tapStartY)) return;

    if (now - lastTapAt <= DOUBLE_TAP_MS) {
      // The second half of a double tap: take back the boost the first half fired and ping instead.
      lastTapAt = 0;
      game.undoRecentBoost();
      fireEcho();
      return;
    }
    lastTapAt = now;
    game.boostNow();
  }

  /**
   * The water's two touches, kept apart by identifier: one holding a direction, one being judged
   * as an ability tap. They used to be the same `e.touches[0]` read, which is why an ability only
   * fired with every other finger off the glass - steering with the stick or the water put a
   * different finger first, and the tap was then measured wherever that finger happened to be.
   * Held separately, a thumb can steer while the other hand taps for Boost or Echolocation.
   */
  let waterSteerTouchId: number | null = null;
  let tapTouchId: number | null = null;

  gameCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      // A press in the middle asks for no direction, so it is free to be an ability tap - and it
      // can be one while another finger steers.
      //
      // The slot is handed over rather than held, which is what was eating Boosts. Steering by
      // holding the water usually puts that finger inside the tap zone - it covers the middle
      // three fifths of the arena - so the steering thumb claimed the tap slot on the way down
      // and kept it for as long as it stayed on the glass. A second finger tapping the middle for
      // Boost was then ignored outright: the slot was taken by a touch that had already
      // disqualified itself by dragging. A candidate that has moved, or that has been held past
      // the point where it could still be a tap, gives the slot up to a fresh press.
      const candidateSpent = tapStartAt === 0 || tapMoved || Date.now() - tapStartAt > TAP_MAX_MS;
      if ((tapTouchId === null || candidateSpent) && inTapZone(touch.clientX, touch.clientY)) {
        tapTouchId = touch.identifier;
        beginTap(touch.clientX, touch.clientY);
      }
      // The stick wins if it is already held: the water must not pull steering off it.
      if (waterSteerTouchId === null && !joystickActive) {
        waterSteerTouchId = touch.identifier;
        updatePointerDirection(touch.clientX, touch.clientY);
      }
    }
  }, { passive: false });

  gameCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === tapTouchId) trackTap(touch.clientX, touch.clientY);
      if (touch.identifier === waterSteerTouchId) updatePointerDirection(touch.clientX, touch.clientY);
    }
  }, { passive: false });

  function releaseWaterTouch(e: TouchEvent, cancelled: boolean): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === tapTouchId) {
        tapTouchId = null;
        if (cancelled) tapStartAt = 0;
        else endTap();
      }
      if (touch.identifier === waterSteerTouchId) {
        waterSteerTouchId = null;
        // Only stop swimming if nothing else is still asking for a direction.
        if (!joystickActive) game.setPointer(false);
      }
    }
  }

  gameCanvas.addEventListener('touchend', (e) => releaseWaterTouch(e, false), { passive: false });
  gameCanvas.addEventListener('touchcancel', (e) => releaseWaterTouch(e, true), { passive: false });

  gameCanvas.addEventListener('mousedown', (e) => {
    beginTap(e.clientX, e.clientY);
    if (!joystickActive) updatePointerDirection(e.clientX, e.clientY);
  });
  gameCanvas.addEventListener('mousemove', (e) => {
    if (!e.buttons) return;
    trackTap(e.clientX, e.clientY);
    if (!joystickActive) updatePointerDirection(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (!joystickActive) game.setPointer(false);
    endTap();
  });
})().catch((e) => showFatal('[main init]', e));

/**
 * Fills a container with drifting bubbles. Used for the page background and again, smaller and
 * quicker, inside the splash poster - the splash stage clips them, so the same .bubble element
 * and floatUp keyframe serve both without a second animation.
 */
function spawnBubbles(container: HTMLElement | null, count: number, opts: {
  minSize: number; maxSize: number; minDuration: number; maxDuration: number; spread: number;
}): void {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = opts.minSize + Math.random() * (opts.maxSize - opts.minSize);
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * 100}%`;
    bubble.style.animationDuration = `${opts.minDuration + Math.random() * (opts.maxDuration - opts.minDuration)}s`;
    bubble.style.animationDelay = `${Math.random() * opts.spread}s`;
    container.appendChild(bubble);
  }
}

spawnBubbles(document.getElementById('bubbles'), 22, {
  minSize: 4, maxSize: 18, minDuration: 10, maxDuration: 28, spread: 20,
});
// Smaller and faster inside the poster, so they read as close to the viewer rather than as the
// same field seen twice. Delays are tight because the splash is only on screen for a moment.
spawnBubbles(document.getElementById('splashBubbles'), 14, {
  minSize: 3, maxSize: 11, minDuration: 7, maxDuration: 15, spread: 9,
});

