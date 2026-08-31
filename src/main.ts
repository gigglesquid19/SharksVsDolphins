import './style.css';
import { Game } from './game';
import { sfx } from './sfx';
import { clearRunCheckpoint, loadRunCheckpoint } from './runState';
import { getDolphinName, hasNamedDolphin, setDolphinName } from './profile';
import { getPearls } from './pearls';
import { setupStore } from './storeView';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

// Android WebView's console bridge only relays file/line/message for uncaught errors and
// promise rejections (no stack) - re-log through console.error, which it relays in full,
// so crashes are diagnosable from `adb logcat` alone.
window.addEventListener('error', (event) => {
  console.error('[onerror]', event.error?.stack || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason?.stack || event.reason);
});

// Registers the Workbox-generated service worker (see vite.config.ts) so the built assets
// are cached for offline play; auto-updates in the background when a new build is deployed.
registerSW({ immediate: true });

const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
const canvasWrap = document.getElementById('canvasWrap') as HTMLDivElement;

const titleScreen = document.getElementById('titleScreen') as HTMLDivElement;
const narrativeScreen = document.getElementById('narrativeScreen') as HTMLDivElement;
const appContent = document.getElementById('appContent') as HTMLDivElement;

const bgMusic = document.getElementById('bgMusic') as HTMLAudioElement;
const muteBtn = document.getElementById('muteBtn') as HTMLButtonElement;
const volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
const MUSIC_MUTED_KEY = 'svsd-music-muted';
const VOLUME_KEY = 'svsd-volume';

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

const levelSelectWrap = document.getElementById('levelSelectWrap') as HTMLSpanElement;
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
splashLogo.src = `${import.meta.env.BASE_URL}game-logo.webp`;
let splashDismissed = false;

function dismissSplash(): void {
  if (splashDismissed) return;
  splashDismissed = true;
  splashScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
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
refreshTitlePearls();

// --- Store ---
const store = setupStore({ onPearlsChange: refreshTitlePearls });
document.getElementById('titleStoreBtn')!.addEventListener('click', () => store.open());

// The "start with N dolphins" testing shortcuts only make sense on level 10 (the Matriarch
// fight, otherwise a long grind to reach in a fresh run) - shown only while that's selected,
// and mutually exclusive with each other (game.ts prefers the 8-dolphin one if both are checked,
// but keeping them visually in sync avoids a misleading "both checked" state).
const levelSelect = document.getElementById('levelSelect') as HTMLSelectElement;
const startWithPodLabel = document.getElementById('startWithPodLabel') as HTMLLabelElement;
const startWithPodCheckbox = document.getElementById('startWithPodCheckbox') as HTMLInputElement;
const startWith8PodLabel = document.getElementById('startWith8PodLabel') as HTMLLabelElement;
const startWith8PodCheckbox = document.getElementById('startWith8PodCheckbox') as HTMLInputElement;

function updateStartWithPodVisibility(): void {
  const isLevel10 = levelSelect.value === '10';
  startWithPodLabel.classList.toggle('hidden', !isLevel10);
  startWith8PodLabel.classList.toggle('hidden', !isLevel10);
}
levelSelect.addEventListener('change', updateStartWithPodVisibility);
updateStartWithPodVisibility();

startWithPodCheckbox.addEventListener('change', () => {
  if (startWithPodCheckbox.checked) startWith8PodCheckbox.checked = false;
});
startWith8PodCheckbox.addEventListener('change', () => {
  if (startWith8PodCheckbox.checked) startWithPodCheckbox.checked = false;
});

function enterAppFromTitle(): void {
  titleScreen.classList.add('hidden');
  narrativeScreen.classList.remove('hidden');
  bgMusic.play().catch((err) => console.warn('Music playback failed:', err));
  sfx.resume();
}

document.getElementById('narrativeContinueBtn')!.addEventListener('click', () => {
  setDolphinName(dolphinNameInput.value);
  refreshDolphinName();
  dolphinNameField.classList.add('hidden');
  narrativeScreen.classList.add('hidden');
  appContent.classList.remove('hidden');
});

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
};

(async function main() {
  const game = new Game(canvas, inputs);
  await game.init();
  const gameCanvas = game.getCanvas();

  inputs.startBtn.addEventListener('click', () => game.retry());

  document.getElementById('titleCampaignBtn')!.addEventListener('click', () => {
    clearRunCheckpoint();
    game.setMode('campaign');
    levelSelectWrap.classList.remove('hidden');
    enterAppFromTitle();
  });
  document.getElementById('titleEndlessBtn')!.addEventListener('click', () => {
    game.setMode('endless');
    levelSelectWrap.classList.add('hidden');
    enterAppFromTitle();
  });
  titleContinueBtn.addEventListener('click', () => {
    if (!savedCheckpoint) return;
    game.setMode('campaign');
    levelSelectWrap.classList.remove('hidden');
    titleScreen.classList.add('hidden');
    narrativeScreen.classList.add('hidden');
    appContent.classList.remove('hidden');
    bgMusic.play().catch((err) => console.warn('Music playback failed:', err));
    sfx.resume();
    game.resumeRun(savedCheckpoint);
  });

  document.getElementById('leaderboardBtn')!.addEventListener('click', () => game.showLeaderboard());
  document.getElementById('achievementsBtn')!.addEventListener('click', () => game.showAchievements());
  document.getElementById('achievementsCloseBtn')!.addEventListener('click', () => game.hideAchievements());

  document.getElementById('runSummarySaveBtn')!.addEventListener('click', () => game.submitPendingScore());
  document.getElementById('runSummaryShareBtn')!.addEventListener('click', () => void game.shareCampaign());
  document.getElementById('runSummarySkipBtn')!.addEventListener('click', () => game.dismissRunSummary());
  document.getElementById('milestoneShareBtn')!.addEventListener('click', () => void game.shareEndless50());
  document.getElementById('milestoneContinueBtn')!.addEventListener('click', () => game.dismissMilestone());
  document.getElementById('schoolBtn')!.addEventListener('click', () => game.formSchool());
  document.getElementById('megaPodBtn')!.addEventListener('click', () => game.summonMegaPod());
  document.getElementById('megaShrimpYellow')!.addEventListener('click', () => game.chooseUpgrade('vitality'));
  document.getElementById('megaShrimpRed')!.addEventListener('click', () => game.chooseUpgrade('speed'));
  document.getElementById('megaShrimpBlue')!.addEventListener('click', () => game.chooseUpgrade('charisma'));
  document.getElementById('megaShrimpGreen')!.addEventListener('click', () => game.chooseUpgrade('boost'));
  document.getElementById('sharkWarningContinueBtn')!.addEventListener('click', () => game.dismissSharkWarning());
  document.getElementById('tutorialHintContinueBtn')!.addEventListener('click', () => game.dismissTutorialHint());
  document.getElementById('leaderboardCloseBtn')!.addEventListener('click', () => game.hideLeaderboard());
  document.getElementById('resetBtn')!.addEventListener('click', () => game.reset());
  document.getElementById('fullscreenBtn')!.addEventListener('click', toggleFullscreen);

  document.getElementById('pauseBtn')!.addEventListener('click', () => game.togglePause());
  document.getElementById('pauseResumeBtn')!.addEventListener('click', () => game.togglePause());
  document.getElementById('pauseRestartBtn')!.addEventListener('click', () => game.retry());
  document.getElementById('pauseResetBtn')!.addEventListener('click', () => game.reset());

  const SCROLLING_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      game.togglePause();
      return;
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

      // The world grid is a fixed 1:1 square, but a phone screen isn't - a true square bounded
      // by width alone only ever covers ~45-55% of a tall screen. Instead of preserving the
      // square, fill most of both dimensions independently (mild stretch, not a hard crop) so
      // the play area actually covers most of the screen. WIDTH_FILL/HEIGHT_FILL leave a small
      // breathing-room margin rather than going fully edge-to-edge.
      const WIDTH_FILL = 0.98;
      const HEIGHT_FILL = 0.7;
      const availableHeight = window.innerHeight - reservedTop;
      gameCanvas.style.width = `${window.innerWidth * WIDTH_FILL}px`;
      gameCanvas.style.height = `${availableHeight * HEIGHT_FILL}px`;
    } else {
      canvasWrap.style.paddingTop = '';
      gameCanvas.style.width = '';
      gameCanvas.style.height = '';
    }
  }

  // In fullscreen, only Start/Retry + Pause stay in the always-visible bar; everything else
  // (settings, secondary actions) relocates into the pause panel so the bar stays one row and
  // the canvas gets that space back. Moved back to their original spot on exiting fullscreen.
  const RELOCATABLE_CONTROL_IDS = [
    'levelSelectWrap',
    'leaderboardBtn',
    'achievementsBtn',
    'fullscreenBtn',
    'muteBtn',
    'volumeControl',
  ];
  let relocatedControls: { el: HTMLElement; parent: HTMLElement; nextSibling: Node | null }[] = [];

  function moveControlsIntoPauseMenu(): void {
    if (relocatedControls.length) return;
    const target = document.getElementById('pauseSettingsList');
    if (!target) return;
    for (const id of RELOCATABLE_CONTROL_IDS) {
      const el = document.getElementById(id);
      if (!el || !el.parentElement) continue;
      relocatedControls.push({ el, parent: el.parentElement, nextSibling: el.nextSibling });
      target.appendChild(el);
    }
  }

  function restoreControlsFromPauseMenu(): void {
    for (const { el, parent, nextSibling } of relocatedControls) {
      parent.insertBefore(el, nextSibling);
    }
    relocatedControls = [];
  }

  // The native Android/iOS app has no browser chrome to escape and always fills the screen,
  // so it gets the compact layout permanently rather than through the (unreliable, in a
  // WebView) Fullscreen API. The Fullscreen toggle itself is meaningless there, so it's
  // hidden rather than relocated.
  function enableNativeCompactLayout(): void {
    canvasWrap.classList.add('compact');
    document.getElementById('fullscreenBtn')?.classList.add('hidden');
    moveControlsIntoPauseMenu();
    applyFullscreenCanvasSize();
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
  });

  window.addEventListener('resize', () => {
    if (isCompactLayout()) applyFullscreenCanvasSize();
  });

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
    game.setPointer(false);
  }

  joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    joystickActive = true;
    joystickBase.classList.add('active');
    handleJoystickMove(touch.clientX, touch.clientY);
  }, { passive: false });

  joystickBase.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    handleJoystickMove(touch.clientX, touch.clientY);
  }, { passive: false });

  joystickBase.addEventListener('touchend', (e) => {
    e.preventDefault();
    endJoystick();
  }, { passive: false });

  joystickBase.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    endJoystick();
  }, { passive: false });

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

  gameCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    updatePointerDirection(touch.clientX, touch.clientY);
  }, { passive: false });

  gameCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    updatePointerDirection(touch.clientX, touch.clientY);
  }, { passive: false });

  gameCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    game.setPointer(false);
  }, { passive: false });

  gameCanvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    game.setPointer(false);
  }, { passive: false });

  gameCanvas.addEventListener('mousedown', (e) => {
    game.setPointer(true);
    updatePointerDirection(e.clientX, e.clientY);
  });
  gameCanvas.addEventListener('mousemove', (e) => {
    if (e.buttons) updatePointerDirection(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => game.setPointer(false));
})();

(function spawnBubbles() {
  const container = document.getElementById('bubbles') as HTMLDivElement;
  const count = 22;
  for (let i = 0; i < count; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = 4 + Math.random() * 14;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * 100}%`;
    (bubble.style as CSSStyleDeclaration).animationDuration = `${10 + Math.random() * 18}s`;
    (bubble.style as CSSStyleDeclaration).animationDelay = `${Math.random() * 20}s`;
    container.appendChild(bubble);
  }
})();
