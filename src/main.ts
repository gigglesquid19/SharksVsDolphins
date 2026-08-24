import './style.css';
import { Game } from './game';
import { sfx } from './sfx';
import { clearRunCheckpoint, loadRunCheckpoint } from './runState';
import { registerSW } from 'virtual:pwa-register';

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
const initialsInputEl = document.getElementById('initialsInput') as HTMLInputElement;
const savedCheckpoint = loadRunCheckpoint();
if (savedCheckpoint) titleContinueBtn.classList.remove('hidden');

function enterAppFromTitle(): void {
  titleScreen.classList.add('hidden');
  narrativeScreen.classList.remove('hidden');
  bgMusic.play().catch((err) => console.warn('Music playback failed:', err));
  sfx.resume();
}

document.getElementById('narrativeContinueBtn')!.addEventListener('click', () => {
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

  function submitInitials(): void {
    game.submitPendingScore(initialsInputEl.value);
  }
  document.getElementById('initialsSubmitBtn')!.addEventListener('click', submitInitials);
  initialsInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitInitials();
  });
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

  function applyFullscreenCanvasSize(): void {
    if (document.fullscreenElement) {
      // The top control bar floats fixed over the canvas in fullscreen; reserve real space
      // for it (measured, since it can wrap onto two rows on a narrower window) so gameplay
      // near the top edge is never hidden behind it.
      const controlsEl = document.querySelector('.canvas-wrap .game-controls') as HTMLElement | null;
      const gap = 12;
      const reservedTop = controlsEl ? controlsEl.getBoundingClientRect().bottom + gap : 0;
      canvasWrap.style.paddingTop = `${reservedTop}px`;

      const size = Math.min(window.innerWidth, window.innerHeight - reservedTop);
      gameCanvas.style.width = `${size}px`;
      gameCanvas.style.height = `${size}px`;
    } else {
      canvasWrap.style.paddingTop = '';
      gameCanvas.style.width = '';
      gameCanvas.style.height = '';
    }
  }

  document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreenBtn') as HTMLButtonElement;
    btn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    applyFullscreenCanvasSize();
  });

  window.addEventListener('resize', () => {
    if (document.fullscreenElement) applyFullscreenCanvasSize();
  });

  const dpadEl = document.getElementById('dpad') as HTMLDivElement;
  const joystickEl = document.getElementById('joystick') as HTMLDivElement;
  const joystickBase = document.getElementById('joystickBase') as HTMLDivElement;
  const joystickThumb = document.getElementById('joystickThumb') as HTMLDivElement;
  const controlModeBtn = document.getElementById('controlModeBtn') as HTMLButtonElement;
  const CONTROL_MODE_KEY = 'svsd-control-mode';
  let controlMode: 'dpad' | 'joystick' = localStorage.getItem(CONTROL_MODE_KEY) === 'joystick' ? 'joystick' : 'dpad';

  function applyControlMode(): void {
    const useJoystick = controlMode === 'joystick';
    dpadEl.classList.toggle('hidden', useJoystick);
    joystickEl.classList.toggle('hidden', !useJoystick);
    controlModeBtn.textContent = useJoystick ? 'Controls: Joystick' : 'Controls: D-Pad';
  }
  applyControlMode();

  controlModeBtn.addEventListener('click', () => {
    controlMode = controlMode === 'dpad' ? 'joystick' : 'dpad';
    localStorage.setItem(CONTROL_MODE_KEY, controlMode);
    applyControlMode();
    game.setPointer(false);
    joystickBase.classList.remove('active');
    joystickThumb.style.transform = '';
  });

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

  document.querySelectorAll('.dpad-btn').forEach((btn) => {
    const key = (btn as HTMLElement).dataset.key!;
    const press = (e: Event) => {
      e.preventDefault();
      game.setKey(key, true);
      btn.classList.add('active');
    };
    const release = (e: Event) => {
      e.preventDefault();
      game.setKey(key, false);
      btn.classList.remove('active');
    };
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
  });

  function updatePointerDirection(clientX: number, clientY: number): void {
    const rect = gameCanvas.getBoundingClientRect();
    game.setPointer(true, (clientX - rect.left) / rect.width - 0.5, (clientY - rect.top) / rect.height - 0.5);
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
