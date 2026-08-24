import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Sprite,
  Assets,
} from 'pixi.js';
import { ParticleSystem } from './particles';
import {
  createDolphinSprite,
  createJellyfishSprite,
  createSharkSprite,
  makeRadialGradientTexture,
  sliceSharkStrip,
  SharkFishSprite,
  SharkKind,
  SharkTextureSet,
} from './sprites';
import { sfx } from './sfx';
import { LEVELS, LevelConfig, getLevelBackground, getLevelConfig } from './levels';
import { CANVAS_SIZE, SIZE } from './constants';
import { clampEntityY, directionDelta, wrapX } from './utils';
import { Dolphin, Shark, MagicShrimp, Jellyfish } from './entities';
import {
  loadCampaignScores,
  loadEndlessScores,
  saveCampaignScore,
  saveEndlessScore,
  NewCampaignScore,
  NewEndlessScore,
} from './scoring';
import { RunCheckpoint, clearRunCheckpoint, saveRunCheckpoint } from './runState';

export type GameMode = 'campaign' | 'endless';
type LeaderboardBoard = 'campaign' | 'endless';
const INITIALS_KEY = 'svsd-initials';

const DOLPHIN_SPAWN_INTERVAL = 15;
const EVENT_CHECK_INTERVAL = 60;
const EVENT_CHANCE = 0.1;
const EVENT_DURATION = 30;
const JELLYFISH_SWARM_DURATION = 45;
const JELLYFISH_COUNT = 70;
const STORM_VISIBILITY_RADIUS = 18;
const HUNTING_MODE_POD_SIZE = 4;
const LARGE_SHARK_SIZE_MULTIPLIER = 1.8;
const SPRINT_DURATION = 1000;
const SPRINT_COOLDOWN = 10000;
const SPRINT_SPEED = 2;
const SHARK_BASE_SCALE = 0.6;
const SHARK_ATTACK_TRIGGER_RADIUS = 6;
const SHARK_KIND_SCALE: Record<SharkKind, number> = {
  greatWhite: 2,
  hammerhead: 2,
  tiger: 1,
};
const HAMMERHEAD_SPEED_BONUS = 1.15;
const GREAT_WHITE_LARGE_SPEED_BONUS = 1.25;

const SHARK_INTRO_INFO: Partial<Record<SharkKind, { name: string; description: string }>> = {
  tiger: {
    name: 'Tiger Shark',
    description: 'Smaller tigers stay close, but larger ones can freeze and lunge at you.',
  },
  hammerhead: {
    name: 'Hammerhead',
    description: 'These sharks will pursue you more relentlessly and can follow you off screen.',
  },
  greatWhite: {
    name: 'Great White Shark',
    description: 'Older Great Whites grow far larger and can take a large pod of dolphins to defeat.',
  },
};

const LARGE_SHARK_INTRO_INFO: Partial<Record<SharkKind, { name: string; description: string }>> = {
  tiger: {
    name: 'Large Tiger Shark',
    description: 'Large tigers can freeze and lunge straight at you. Keep moving.',
  },
  hammerhead: {
    name: 'Large Hammerhead Shark',
    description: 'Large hammerheads are faster and can pursue you relentlessly.',
  },
  greatWhite: {
    name: 'Large Great White Shark',
    description: 'A huge great white that can charge at high speed. It takes a full pod to bring down.',
  },
};

type GameEventType = 'storm' | 'jellyfish';

export class Game {
  private canvas: HTMLCanvasElement;
  private app!: Application;

  private keys: Record<string, boolean> = {};
  private environment: number[][] = [];
  private dolphins: Dolphin[] = [];
  private sharks: Shark[] = [];
  private player: Dolphin | null = null;
  private originalPlayer: Dolphin | null = null;
  private disbanded = false;
  private dolphinSpawnInterval = DOLPHIN_SPAWN_INTERVAL;

  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private gameTime = 0;
  private nextDolphinSpawnTime = 60;
  private lastFrameTime = 0;
  private magicShrimp: MagicShrimp | null = null;
  private shrimpSpawned = false;
  private playerHitCooldownUntil = 0;
  private huntingMode = false;
  private readyToSchool = false;
  private maxDolphins = 8;
  private bubbleTimer = 0;
  private activeEvent: { type: GameEventType; endsAt: number } | null = null;
  private nextEventCheckTime = EVENT_CHECK_INTERVAL;
  private pendingEvent: GameEventType | null = null;
  private nextStormWarningTime = -5;
  private stormWarningShown = false;
  private jellyfish: Jellyfish[] = [];
  private jellyfishContainer!: Container;
  private jellyfishSprites = new Map<Jellyfish, Container>();
  private matriarch: Shark | null = null;
  private matriarchWarningTime = 0;
  private matriarchSpawnTime = 0;
  private matriarchWarningShown = false;
  private matriarchSpawnerTimer = 0;
  private matriarchSmallCleared = false;
  private levelCompleted = false;
  private awaitingNewWaters = false;
  private awaitingLevelUpChoice = false;
  private awaitingSharkWarning = false;
  private seenSharkKinds = new Set<SharkKind>();
  private seenLargeSharkKinds = new Set<SharkKind>();
  private seenLargeSharkVariety = false;
  private autoFormedThisLevel = false;
  private currentLevel = 1;
  private retries = 0;
  private totalRecruited = 0;
  private totalLost = 0;
  private sharksKilled = 0;
  private sessionStartTime = 0;
  private sprinting = false;
  private sprintEndTime = 0;
  private sprintCooldownEnd = 0;
  private sprintCooldownReduction = 0;
  private vitalityLives = 0;
  private speedBonusPct = 0;
  private charismaBonusDolphins = 0;
  private mode: GameMode = 'campaign';
  private currentLeaderboardBoard: LeaderboardBoard = 'campaign';
  private pendingScore:
    | { board: 'campaign'; score: Omit<NewCampaignScore, 'initials'> }
    | { board: 'endless'; score: Omit<NewEndlessScore, 'initials'> }
    | null = null;

  private pointerActive = false;
  private pointerDirX = 0;
  private pointerDirY = 0;

  private sharkSpeedInput: HTMLInputElement;
  private speedInput: HTMLInputElement;
  private startBtn: HTMLButtonElement;
  private statTime: HTMLElement;
  private statSpawn: HTMLElement;
  private statShrimp: HTMLElement;
  private statDolphins: HTMLElement;
  private statSharks: HTMLElement;
  private statStatus: HTMLElement;
  private sharkGuideList: HTMLElement;
  private lastLifeHeart: HTMLElement | null = null;
  private levelBadgeNumberEl: HTMLElement | null = null;
  private bannerEl: HTMLDivElement;
  private bannerTimeout: ReturnType<typeof setTimeout> | null = null;
  private newWatersPromptEl: HTMLDivElement;
  private pauseOverlayEl: HTMLDivElement;
  private schoolBtnWrap: HTMLDivElement;
  private disbandBtnWrap: HTMLDivElement | null = null;
  private disbandBtn: HTMLButtonElement | null = null;
  private levelSelect: HTMLSelectElement | null = null;
  private leaderboardOverlayEl: HTMLDivElement | null = null;
  private leaderboardListEl: HTMLElement | null = null;
  private leaderboardHeadEl: HTMLElement | null = null;
  private leaderboardHeadingEl: HTMLElement | null = null;
  private leaderboardTabCampaignBtn: HTMLButtonElement | null = null;
  private leaderboardTabEndlessBtn: HTMLButtonElement | null = null;
  private initialsOverlayEl: HTMLDivElement | null = null;
  private initialsHeadingEl: HTMLElement | null = null;
  private initialsSummaryEl: HTMLElement | null = null;
  private initialsInputEl: HTMLInputElement | null = null;
  private levelUpOverlayEl: HTMLDivElement;
  private sharkWarningOverlayEl: HTMLDivElement;
  private sharkWarningListEl: HTMLDivElement;
  private onSchoolingChange?: (active: boolean) => void;
  private paused = false;

  private stage!: Container;
  private bgContainer!: Container;
  private fxContainer!: Container;
  private entityContainer!: Container;
  private stormOverlay!: Graphics;
  private particles!: ParticleSystem;
  private dolphinSprites = new Map<Dolphin, Container>();
  private sharkSprites = new Map<Shark, Container>();
  private shrimpSprite: Container | null = null;

  private glowTexture: Texture;
  private sharkTextureSets: Partial<Record<SharkKind, SharkTextureSet>> = {};

  constructor(
    canvas: HTMLCanvasElement,
    inputs: {
      sharkSpeed: HTMLInputElement;
      speed: HTMLInputElement;
      startBtn: HTMLButtonElement;
      statTime: HTMLElement;
      statSpawn: HTMLElement;
      statShrimp: HTMLElement;
      statDolphins: HTMLElement;
      statSharks: HTMLElement;
      statStatus: HTMLElement;
      sharkGuideList: HTMLElement;
      banner: HTMLDivElement;
      newWatersPrompt: HTMLDivElement;
      pauseOverlay: HTMLDivElement;
      schoolBtnWrap: HTMLDivElement;
      levelUpOverlay: HTMLDivElement;
      sharkWarningOverlay: HTMLDivElement;
      sharkWarningList: HTMLDivElement;
      onSchoolingChange?: (active: boolean) => void;
    }
  ) {
    this.canvas = canvas;

    this.sharkSpeedInput = inputs.sharkSpeed;
    this.speedInput = inputs.speed;
    this.startBtn = inputs.startBtn;
    this.statTime = inputs.statTime;
    this.statSpawn = inputs.statSpawn;
    this.statShrimp = inputs.statShrimp;
    this.statDolphins = inputs.statDolphins;
    this.statSharks = inputs.statSharks;
    this.statStatus = inputs.statStatus;
    this.sharkGuideList = inputs.sharkGuideList;
    this.bannerEl = inputs.banner;
    this.newWatersPromptEl = inputs.newWatersPrompt;
    this.pauseOverlayEl = inputs.pauseOverlay;
    this.schoolBtnWrap = inputs.schoolBtnWrap;
    this.disbandBtnWrap = document.getElementById('disbandBtnWrap') as HTMLDivElement | null;
    this.disbandBtn = document.getElementById('disbandBtn') as HTMLButtonElement | null;
    this.disbandBtn?.addEventListener('click', () => this.switchDolphin());
    this.levelSelect = document.getElementById('levelSelect') as HTMLSelectElement | null;
    this.leaderboardOverlayEl = document.getElementById('leaderboardOverlay') as HTMLDivElement | null;
    this.leaderboardListEl = document.getElementById('leaderboardList') as HTMLElement | null;
    this.leaderboardHeadEl = document.getElementById('leaderboardHead') as HTMLElement | null;
    this.leaderboardHeadingEl = document.getElementById('leaderboardHeading') as HTMLElement | null;
    this.leaderboardTabCampaignBtn = document.getElementById('leaderboardTabCampaign') as HTMLButtonElement | null;
    this.leaderboardTabEndlessBtn = document.getElementById('leaderboardTabEndless') as HTMLButtonElement | null;
    this.leaderboardTabCampaignBtn?.addEventListener('click', () => this.showLeaderboard('campaign'));
    this.leaderboardTabEndlessBtn?.addEventListener('click', () => this.showLeaderboard('endless'));
    this.initialsOverlayEl = document.getElementById('initialsOverlay') as HTMLDivElement | null;
    this.initialsHeadingEl = document.getElementById('initialsHeading') as HTMLElement | null;
    this.initialsSummaryEl = document.getElementById('initialsSummary') as HTMLElement | null;
    this.initialsInputEl = document.getElementById('initialsInput') as HTMLInputElement | null;
    this.levelUpOverlayEl = inputs.levelUpOverlay;
    this.sharkWarningOverlayEl = inputs.sharkWarningOverlay;
    this.sharkWarningListEl = inputs.sharkWarningList;
    this.onSchoolingChange = inputs.onSchoolingChange;
    this.lastLifeHeart = document.getElementById('lastLifeHeart');
    this.levelBadgeNumberEl = document.getElementById('levelBadgeNumber');

    this.glowTexture = makeRadialGradientTexture(64, 'rgba(34, 211, 238, 0.45)');
  }

  async init(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      background: '#020617',
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.app.canvas.id = 'simCanvas';
    this.app.canvas.style.borderRadius = '14px';
    this.app.canvas.style.touchAction = 'none';
    this.canvas.parentNode?.replaceChild(this.app.canvas, this.canvas);

    this.stage = this.app.stage;

    this.bgContainer = new Container();
    this.fxContainer = new Container();
    this.entityContainer = new Container();
    this.jellyfishContainer = new Container();
    this.stage.addChild(this.bgContainer);
    this.stage.addChild(this.jellyfishContainer);
    this.stage.addChild(this.fxContainer);
    this.stage.addChild(this.entityContainer);

    this.stormOverlay = new Graphics();
    this.stage.addChild(this.stormOverlay);

    this.particles = new ParticleSystem(this.fxContainer);

    await this.createBackground();
    await this.loadSharkTextures();
    this.createEnvironment();
    this.initModel(this.getSelectedLevelConfig());
  }

  private getSelectedLevelConfig(): LevelConfig {
    if (this.mode === 'endless') return LEVELS[0];
    const level = parseInt(this.levelSelect?.value ?? '1', 10);
    return LEVELS[level - 1] ?? LEVELS[0];
  }

  /** Sets which mode a fresh start/reset begins in. Campaign: pick a level 1-10, saves/resumes, ends at level 10. Endless: always starts at level 1, no free resume, continues past level 10 until death. */
  setMode(mode: GameMode): void {
    this.mode = mode;
  }

  private async loadSharkTextures(): Promise<void> {
    const sources: { kind: SharkKind; move: string; attack: string }[] = [
      { kind: 'greatWhite', move: '/sharks/spr_shark_move_strip9.png', attack: '/sharks/spr_shark_attack_strip9.png' },
      { kind: 'hammerhead', move: '/sharks/spr_hammerhead_shark_move_strip9.png', attack: '/sharks/spr_hammerhead_shark_attack_strip9.png' },
      { kind: 'tiger', move: '/sharks/spr_tiger_shark_move_strip9.png', attack: '/sharks/spr_tiger_shark_attack_strip9.png' },
    ];

    await Promise.all(
      sources.map(async ({ kind, move, attack }) => {
        const [moveBase, attackBase] = await Promise.all([Assets.load(move), Assets.load(attack)]);
        this.sharkTextureSets[kind] = {
          move: sliceSharkStrip(moveBase),
          attack: sliceSharkStrip(attackBase),
        };
      })
    ).catch((err) => console.warn('Shark texture load failed:', err));
  }

  getCanvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  setKey(key: string, pressed: boolean): void {
    this.keys[key] = pressed;
  }

  setPointer(active: boolean, dirX?: number, dirY?: number): void {
    this.pointerActive = active;
    if (typeof dirX === 'number') this.pointerDirX = dirX;
    if (typeof dirY === 'number') this.pointerDirY = dirY;
  }

  start(): void {
    if (!this.initModel(this.getSelectedLevelConfig())) return;
    this.sessionStartTime = Date.now();
    this.running = true;
    this.startBtn.textContent = 'Restart';
    this.setStatus('Swimming');
    this.step();
  }

  reset(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    clearRunCheckpoint();
    this.createEnvironment();
    this.initModel(this.getSelectedLevelConfig());
    this.setStatus('Ready');
    this.startBtn.textContent = 'Start';
  }

  retry(): void {
    const config = getLevelConfig(this.currentLevel);
    if (this.sessionStartTime === 0) {
      this.sessionStartTime = Date.now();
    } else {
      this.retries++;
    }
    if (!this.initModel(config, true)) return;
    this.running = true;
    this.startBtn.textContent = 'Retry';
    this.setStatus('Swimming');
    this.step();
  }

  /** Restores a checkpoint saved by a previous session and resumes play at that level. */
  resumeRun(checkpoint: RunCheckpoint): boolean {
    this.mode = 'campaign';
    this.vitalityLives = checkpoint.vitalityLives;
    this.speedBonusPct = checkpoint.speedBonusPct;
    this.charismaBonusDolphins = checkpoint.charismaBonusDolphins;
    this.sprintCooldownReduction = checkpoint.sprintCooldownReduction;
    this.retries = checkpoint.retries;
    this.totalRecruited = checkpoint.totalRecruited;
    this.totalLost = checkpoint.totalLost;
    this.sharksKilled = checkpoint.sharksKilled;
    this.seenSharkKinds = new Set(checkpoint.seenSharkKinds);
    this.seenLargeSharkKinds = new Set(checkpoint.seenLargeSharkKinds);
    this.seenLargeSharkVariety = checkpoint.seenLargeSharkVariety;

    if (!this.initModel(getLevelConfig(checkpoint.level), true)) return false;
    this.sessionStartTime = Date.now() - checkpoint.elapsedSeconds * 1000;
    this.running = true;
    this.startBtn.textContent = 'Retry';
    this.setStatus('Swimming');
    this.step();
    return true;
  }

  private saveCheckpoint(): void {
    saveRunCheckpoint({
      level: this.currentLevel,
      vitalityLives: this.vitalityLives,
      speedBonusPct: this.speedBonusPct,
      charismaBonusDolphins: this.charismaBonusDolphins,
      sprintCooldownReduction: this.sprintCooldownReduction,
      retries: this.retries,
      totalRecruited: this.totalRecruited,
      totalLost: this.totalLost,
      sharksKilled: this.sharksKilled,
      elapsedSeconds: this.sessionStartTime > 0 ? (Date.now() - this.sessionStartTime) / 1000 : this.gameTime,
      seenSharkKinds: [...this.seenSharkKinds],
      seenLargeSharkKinds: [...this.seenLargeSharkKinds],
      seenLargeSharkVariety: this.seenLargeSharkVariety,
    });
  }

  togglePause(): void {
    if (this.paused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  formSchool(): void {
    if (!this.readyToSchool || this.huntingMode || this.activeEvent?.type === 'jellyfish') return;
    this.huntingMode = true;
    this.readyToSchool = false;
    this.schoolBtnWrap.classList.add('hidden');
    this.setStatus('HUNTING MODE: ram sharks to destroy them');
    this.updateHuntingVisuals();
    this.onSchoolingChange?.(true);
  }

  switchDolphin(): void {
    if (!this.player || this.dolphins.length <= 1 || this.activeEvent?.type !== 'jellyfish') return;
    if (!this.disbanded) {
      this.originalPlayer = this.player;
      this.disbanded = true;
    }
    const idx = this.dolphins.indexOf(this.player);
    this.dolphins[idx].isPlayer = false;
    const nextIdx = (idx + 1) % this.dolphins.length;
    const next = this.dolphins[nextIdx];
    next.isPlayer = true;
    this.player = next;
    this.setStatus('Switched to another dolphin');
  }

  private pauseGame(): void {
    if (!this.running || this.paused || this.awaitingLevelUpChoice || this.awaitingSharkWarning) return;
    this.paused = true;
    if (this.timer) clearTimeout(this.timer);
    this.setStatus('Paused');
    this.pauseOverlayEl.classList.remove('hidden');
  }

  private resumeGame(): void {
    if (!this.paused) return;
    this.paused = false;
    this.pauseOverlayEl.classList.add('hidden');
    this.setStatus('Swimming');
    this.lastFrameTime = 0;
    this.step();
  }

  private setStatus(text: string): void {
    this.statStatus.textContent = text;
  }

  private showBanner(
    text: string,
    type: 'gameover' | 'victory' | 'recruited' | 'lost' | 'storm' | 'levelup' | 'statup',
    duration?: number
  ): void {
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }
    this.bannerEl.textContent = text;
    this.bannerEl.className = `game-banner visible ${type}`;
    if (duration) {
      this.bannerTimeout = setTimeout(() => {
        this.bannerEl.classList.remove('visible');
      }, duration);
    }
  }

  private hideBanner(): void {
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }
    this.bannerEl.classList.remove('visible');
  }

  private updateHuntingVisuals(): void {
    const wrap = this.app.canvas.parentElement;
    if (wrap) wrap.classList.toggle('hunting', this.huntingMode);
  }

  private async createBackground(): Promise<void> {
    await this.loadBackground('/OpenOceanBGImage.webp');
  }

  private async loadBackground(url: string): Promise<void> {
    const texture = await Assets.load(url);
    const bg = new Sprite(texture);

    const scale = Math.max(CANVAS_SIZE / bg.width, CANVAS_SIZE / bg.height);
    bg.anchor.set(0.5);
    bg.scale.set(scale);
    bg.position.set(CANVAS_SIZE / 2, CANVAS_SIZE / 2);

    this.bgContainer.removeChildren();
    this.bgContainer.addChild(bg);
  }

  private createEnvironment(): void {
    this.environment = [];
    for (let y = 0; y < SIZE; y++) {
      const row: number[] = [];
      for (let x = 0; x < SIZE; x++) {
        row.push(Math.floor(Math.random() * 100));
      }
      this.environment.push(row);
    }
  }

  private findSafestCorner(): { x: number; y: number } {
    const margin = 8;
    const yMin = 12;
    const candidates: { x: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      candidates.push({
        x: Math.floor(margin + Math.random() * (SIZE - margin * 2)),
        y: Math.floor(yMin + Math.random() * (SIZE - yMin - margin)),
      });
    }
    let best = candidates[0];
    let bestDist = 0;
    for (const c of candidates) {
      let minDist = Infinity;
      for (const shark of this.sharks) {
        const d = Math.sqrt((shark._x - c.x) ** 2 + (shark._y - c.y) ** 2);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestDist) {
        bestDist = minDist;
        best = c;
      }
    }
    return best;
  }

  private spawnRecruitableDolphin(): void {
    const corner = this.findSafestCorner();
    const dolphin = new Dolphin(this.dolphins.length, corner.y, corner.x);
    this.dolphins.push(dolphin);
    this.addDolphinSprite(dolphin);
    this.setStatus('A lost dolphin appeared');
  }

  private initModel(config = LEVELS[0], keepUpgrades = false): boolean {
    this.entityContainer.removeChildren();
    this.dolphinSprites.clear();
    this.sharkSprites.clear();
    this.shrimpSprite = null;
    this.particles.clear();

    this.dolphins = [];
    const px = Math.floor(SIZE / 2);
    const py = Math.floor(SIZE / 2);
    this.player = new Dolphin(0, py, px);
    this.player.isPlayer = true;
    this.player.invulnerableUntil = Date.now() + 5000;
    this.dolphins.push(this.player);
    this.addDolphinSprite(this.player);

    if (!keepUpgrades) {
      this.vitalityLives = 0;
      this.speedBonusPct = 0;
      this.charismaBonusDolphins = 0;
      this.sprintCooldownReduction = 0;
      this.seenSharkKinds = new Set<SharkKind>();
      this.seenLargeSharkKinds = new Set<SharkKind>();
      this.seenLargeSharkVariety = false;
      this.retries = 0;
      this.totalRecruited = 0;
      this.totalLost = 0;
      this.sharksKilled = 0;
      this.sessionStartTime = 0;
      this.leaderboardOverlayEl?.classList.add('hidden');
    }

    for (let i = 0; i < this.charismaBonusDolphins; i++) {
      const bonusDolphin = new Dolphin(this.dolphins.length, py, px);
      bonusDolphin.recruited = true;
      this.totalRecruited++;
      this.dolphins.push(bonusDolphin);
      this.addDolphinSprite(bonusDolphin);
    }

    this.currentLevel = config.level;
    this.sharks = [];
    this.gameTime = 0;
    this.spawnSharksForLevel(config);
    this.draw();

    this.startTime = 0;
    this.nextDolphinSpawnTime = this.dolphinSpawnInterval;
    this.lastFrameTime = 0;
    this.magicShrimp = null;
    this.shrimpSpawned = false;
    this.disbanded = false;
    this.originalPlayer = null;
    if (this.disbandBtnWrap) this.disbandBtnWrap.classList.add('hidden');
    this.playerHitCooldownUntil = 0;
    this.hideBanner();
    this.activeEvent = null;
    this.nextEventCheckTime = EVENT_CHECK_INTERVAL;
    this.pendingEvent = null;
    this.stormWarningShown = false;
    this.planNextEvent();
    this.clearJellyfish();
    this.stormOverlay.clear();
    sfx.stopStormRumble();
    this.levelCompleted = false;
    this.autoFormedThisLevel = false;
    this.sprinting = false;
    this.sprintEndTime = 0;
    this.sprintCooldownEnd = 0;
    this.awaitingNewWaters = false;
    this.newWatersPromptEl.classList.remove('visible');
    this.awaitingLevelUpChoice = false;
    this.levelUpOverlayEl.classList.add('hidden');
    this.awaitingSharkWarning = false;
    this.sharkWarningOverlayEl.classList.add('hidden');
    this.paused = false;
    this.pauseOverlayEl.classList.add('hidden');
    this.loadBackground(getLevelBackground(config.level)).catch((err) => console.warn('Background load failed:', err));
    this.updateStats();
    this.draw();
    this.checkForNewSharks(config);
    this.announceLevel();
    return true;
  }

  private announceLevel(duration = 2200): void {
    this.updateLevelBadge();
    this.showBanner(`Level ${this.currentLevel}`, 'victory', duration);
  }

  private updateLevelBadge(): void {
    if (this.levelBadgeNumberEl) this.levelBadgeNumberEl.textContent = String(this.currentLevel);
  }

  private addDolphinSprite(dolphin: Dolphin): void {
    const container = new Container();

    const glow = new Sprite(this.glowTexture);
    glow.anchor.set(0.5);
    glow.width = 28;
    glow.height = 28;
    glow.alpha = 0.5;
    glow.name = 'glow';
    container.addChild(glow);

    const ring = new Graphics();
    ring.circle(0, 0, 14).stroke({ width: 2, color: 0xfacc15, alpha: 0 });
    ring.name = 'boostRing';
    container.addChild(ring);

    const invulRing = new Graphics();
    invulRing.circle(0, 0, 14).stroke({ width: 2, color: 0xa855f7, alpha: 0 });
    invulRing.name = 'invulRing';
    container.addChild(invulRing);

    const fish = createDolphinSprite();
    fish.name = 'fish';
    container.addChild(fish);

    this.entityContainer.addChild(container);
    this.dolphinSprites.set(dolphin, container);
  }

  private removeDolphinSprite(dolphin: Dolphin): void {
    const sprite = this.dolphinSprites.get(dolphin);
    if (sprite) {
      this.entityContainer.removeChild(sprite);
      sprite.destroy();
      this.dolphinSprites.delete(dolphin);
    }
  }

  private removeSharkSprite(shark: Shark): void {
    const sprite = this.sharkSprites.get(shark);
    if (sprite) {
      this.entityContainer.removeChild(sprite);
      sprite.destroy();
      this.sharkSprites.delete(shark);
    }
  }

  private addSharkSprite(shark: Shark): void {
    const container = new Container();

    const glowTex = makeRadialGradientTexture(64, 'rgba(248, 113, 113, 0.5)');
    const glow = new Sprite(glowTex);
    glow.anchor.set(0.5);
    glow.width = 48;
    glow.height = 48;
    glow.alpha = 0.5;
    glow.name = 'glow';
    container.addChild(glow);

    const textureSet =
      this.sharkTextureSets[shark.kind] ??
      this.sharkTextureSets.greatWhite ??
      this.sharkTextureSets.hammerhead ??
      this.sharkTextureSets.tiger;

    if (textureSet) {
      try {
        const fish = createSharkSprite(textureSet);
        fish.name = 'fish';
        fish.scale.set(SHARK_BASE_SCALE);
        container.addChild(fish);
      } catch (err) {
        console.warn('Failed to create shark sprite, using fallback:', err);
        container.addChild(this.createFallbackSharkFish());
      }
    } else {
      console.warn('No shark textures available yet, using fallback shark sprite.');
      container.addChild(this.createFallbackSharkFish());
    }

    const reqText = new Text({
      text: '',
      style: {
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: '#ffffff',
        align: 'center',
        fontWeight: 'bold',
      },
    });
    reqText.anchor.set(0.5);
    reqText.name = 'reqText';
    container.addChild(reqText);

    this.entityContainer.addChild(container);
    this.sharkSprites.set(shark, container);
  }

  private createFallbackSharkFish(): Container {
    const fish = new Container();
    fish.name = 'fish';
    const body = new Graphics();
    body.ellipse(0, 0, 17, 7.5).fill({ color: 0x64748b });
    body.moveTo(13, -3).lineTo(21, 0).lineTo(13, 3).closePath().fill({ color: 0x64748b });
    fish.addChild(body);
    return fish;
  }

  private addShrimpSprite(): void {
    if (this.shrimpSprite) return;
    const container = new Container();

    const glowTex = makeRadialGradientTexture(64, 'rgba(250, 204, 21, 0.6)');
    const glow = new Sprite(glowTex);
    glow.anchor.set(0.5);
    glow.width = 32;
    glow.height = 32;
    glow.alpha = 0.6;
    container.addChild(glow);

    const text = new Text({
      text: '🍤',
      style: {
        fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
        fill: '#ffffff',
        fontSize: 30,
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    container.addChild(text);

    this.entityContainer.addChild(container);
    this.shrimpSprite = container;
  }

  private moveTowards(dolphin: Dolphin, tx: number, ty: number, speed: number): void {
    const dx = Math.sign(directionDelta(tx, dolphin._x));
    const dy = Math.sign(ty - dolphin._y);
    dolphin._x = wrapX(dolphin._x + dx * speed);
    dolphin._y = clampEntityY(dolphin._y + dy * speed, 2);
  }

  private moveFollowers(): void {
    if (!this.player || this.disbanded) return;
    const boosted = Date.now() < this.player.speedBoostUntil;
    const followerSpeed = (boosted ? 4 : 2) * (1 + this.speedBonusPct) * (this.sprinting ? SPRINT_SPEED : 1);
    const followers = this.dolphins.filter((d) => d.recruited && !d.isPlayer);
    followers.forEach((dolphin, idx) => {
      const angle = (idx / followers.length) * Math.PI * 2 + this.gameTime * 0.5;
      const radius = 6;
      const tx = wrapX(this.player!._x + Math.round(Math.cos(angle) * radius));
      const ty = clampEntityY(this.player!._y + Math.round(Math.sin(angle) * radius), 2);
      this.moveTowards(dolphin, tx, ty, followerSpeed);
    });
  }

  private gameOver(): void {
    this.running = false;
    this.totalLost++;
    if (this.timer) clearTimeout(this.timer);
    this.setStatus('Eaten by a shark');
    this.startBtn.textContent = 'Retry';
    this.showBanner('Game Over', 'gameover');

    // Endless runs end permanently on death (no free checkpoint resume) and record a
    // depth/survival-time score; this is also the intended hook for a future pay-to-continue offer.
    if (this.mode === 'endless') {
      const timeSurvived = this.sessionStartTime > 0 ? (Date.now() - this.sessionStartTime) / 1000 : this.gameTime;
      this.pendingScore = {
        board: 'endless',
        score: {
          levelReached: this.currentLevel,
          timeSurvived,
          recruited: this.totalRecruited,
          sharksKilled: this.sharksKilled,
        },
      };
      this.showInitialsPrompt('Game Over', `Reached level ${this.currentLevel} - survived ${timeSurvived.toFixed(1)}s`);
    }
  }

  private levelComplete(): void {
    this.levelCompleted = true;
    if (this.mode === 'campaign' && this.currentLevel === LEVELS.length) {
      this.recordCampaignClear();
      return;
    }
    this.setStatus('All sharks destroyed!');
    this.showLevelUpChoice();
  }

  /** Campaign-mode classic ending: clearing level 10 stops the run and prompts for the leaderboard. */
  private recordCampaignClear(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    clearRunCheckpoint();
    const timeToSaveOcean = this.sessionStartTime > 0 ? (Date.now() - this.sessionStartTime) / 1000 : this.gameTime;
    this.pendingScore = {
      board: 'campaign',
      score: {
        timeToSaveOcean,
        retries: this.retries,
        recruited: this.totalRecruited,
        lost: this.totalLost,
        sharksKilled: this.sharksKilled,
      },
    };
    this.setStatus('You cleared the campaign! The ocean is safe.');
    this.startBtn.textContent = 'Retry';
    this.showBanner('Ocean Saved!', 'victory');
    this.showInitialsPrompt('Ocean Saved!', `Cleared in ${timeToSaveOcean.toFixed(1)}s`);
  }

  private showInitialsPrompt(heading: string, summary: string): void {
    if (!this.initialsOverlayEl || !this.initialsInputEl) return;
    if (this.initialsHeadingEl) this.initialsHeadingEl.textContent = heading;
    if (this.initialsSummaryEl) this.initialsSummaryEl.textContent = summary;
    let remembered = '';
    try {
      remembered = localStorage.getItem(INITIALS_KEY) ?? '';
    } catch (e) {
      console.warn('Failed to read remembered initials', e);
    }
    this.initialsInputEl.value = remembered;
    this.initialsOverlayEl.classList.remove('hidden');
    this.initialsInputEl.focus();
    this.initialsInputEl.select();
  }

  /** Saves the pending score (from a campaign clear or an endless game over) with the player's initials. */
  submitPendingScore(rawInitials: string): void {
    if (!this.pendingScore) return;
    const clean = rawInitials.trim().slice(0, 3).toUpperCase() || 'AAA';
    try {
      localStorage.setItem(INITIALS_KEY, clean);
    } catch (e) {
      console.warn('Failed to save initials', e);
    }

    if (this.pendingScore.board === 'campaign') {
      saveCampaignScore({ ...this.pendingScore.score, initials: clean });
    } else {
      saveEndlessScore({ ...this.pendingScore.score, initials: clean });
    }
    const board = this.pendingScore.board;
    this.pendingScore = null;
    this.initialsOverlayEl?.classList.add('hidden');
    this.showLeaderboard(board);
  }

  showLeaderboard(board: LeaderboardBoard = this.currentLeaderboardBoard): void {
    if (!this.leaderboardListEl || !this.leaderboardHeadEl) return;
    this.currentLeaderboardBoard = board;
    this.leaderboardTabCampaignBtn?.classList.toggle('active', board === 'campaign');
    this.leaderboardTabEndlessBtn?.classList.toggle('active', board === 'endless');
    this.leaderboardListEl.innerHTML = '';

    if (board === 'campaign') {
      if (this.leaderboardHeadingEl) this.leaderboardHeadingEl.textContent = 'Campaign Leaderboard';
      this.leaderboardHeadEl.innerHTML =
        '<tr><th>#</th><th>Initials</th><th>Time</th><th>Retries</th><th>Recruited</th><th>Lost</th><th>Sharks</th></tr>';
      const scores = loadCampaignScores();
      if (scores.length === 0) {
        this.renderEmptyLeaderboardRow(7, 'No completed campaign runs yet.');
      } else {
        for (const [i, s] of scores.entries()) {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${i + 1}</td><td>${s.initials}</td><td>${s.timeToSaveOcean.toFixed(1)}s</td><td>${s.retries}</td><td>${s.recruited}</td><td>${s.lost}</td><td>${s.sharksKilled}</td>`;
          this.leaderboardListEl.appendChild(row);
        }
      }
    } else {
      if (this.leaderboardHeadingEl) this.leaderboardHeadingEl.textContent = 'Endless Leaderboard';
      this.leaderboardHeadEl.innerHTML = '<tr><th>#</th><th>Initials</th><th>Level</th><th>Survived</th><th>Recruited</th><th>Sharks</th></tr>';
      const scores = loadEndlessScores();
      if (scores.length === 0) {
        this.renderEmptyLeaderboardRow(6, 'No endless runs yet.');
      } else {
        for (const [i, s] of scores.entries()) {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${i + 1}</td><td>${s.initials}</td><td>${s.levelReached}</td><td>${s.timeSurvived.toFixed(1)}s</td><td>${s.recruited}</td><td>${s.sharksKilled}</td>`;
          this.leaderboardListEl.appendChild(row);
        }
      }
    }

    this.leaderboardOverlayEl?.classList.remove('hidden');
  }

  private renderEmptyLeaderboardRow(colSpan: number, text: string): void {
    if (!this.leaderboardListEl) return;
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = colSpan;
    cell.textContent = text;
    row.appendChild(cell);
    this.leaderboardListEl.appendChild(row);
  }

  hideLeaderboard(): void {
    this.leaderboardOverlayEl?.classList.add('hidden');
    if (this.running && !this.paused) {
      this.lastFrameTime = 0;
      this.step();
    }
  }

  private showLevelUpChoice(): void {
    this.awaitingLevelUpChoice = true;
    const bannerText = this.mode === 'endless' && this.currentLevel === LEVELS.length ? 'Ocean Saved! Endless Waters Await...' : 'Level Up!';
    this.showBanner(bannerText, 'levelup', 2600);
    this.levelUpOverlayEl.classList.remove('hidden');
  }

  chooseUpgrade(kind: 'vitality' | 'speed' | 'charisma' | 'boost'): void {
    if (!this.awaitingLevelUpChoice) return;
    this.awaitingLevelUpChoice = false;
    this.levelUpOverlayEl.classList.add('hidden');

    let statName = '';
    switch (kind) {
      case 'vitality':
        this.vitalityLives += 1;
        statName = 'Vitality';
        break;
      case 'speed':
        this.speedBonusPct += 0.1;
        statName = 'Speed';
        break;
      case 'charisma':
        this.charismaBonusDolphins += 1;
        statName = 'Charisma';
        break;
      case 'boost':
        this.sprintCooldownReduction += 1500;
        statName = 'Boost';
        break;
    }

    this.showBanner(`${statName} Increased!`, 'statup', 2200);
    this.setStatus(`Swim east to reach Level ${this.currentLevel + 1}`);
    this.awaitingNewWaters = true;
    this.newWatersPromptEl.classList.add('visible');

    if (this.running && !this.paused) {
      this.lastFrameTime = 0;
      this.step();
    }
  }

  private async advanceLevel(): Promise<void> {
    this.awaitingNewWaters = false;
    this.newWatersPromptEl.classList.remove('visible');
    this.currentLevel += 1;
    const config = getLevelConfig(this.currentLevel);

    this.setStatus(`Level ${this.currentLevel}: hunt the sharks!`);
    this.announceLevel(2500);

    if (this.player) {
      for (const dolphin of this.dolphins) {
        if (!dolphin.isPlayer) this.removeDolphinSprite(dolphin);
      }
      this.dolphins = [this.player];

      for (let i = 0; i < this.charismaBonusDolphins; i++) {
        const bonusDolphin = new Dolphin(this.dolphins.length, this.player._y, this.player._x);
        bonusDolphin.recruited = true;
        this.totalRecruited++;
        this.dolphins.push(bonusDolphin);
        this.addDolphinSprite(bonusDolphin);
      }

      this.player.invulnerableUntil = Date.now() + 5000;
      this.autoFormedThisLevel = false;
    }

    this.levelCompleted = false;
    this.spawnSharksForLevel(config);
    this.checkForNewSharks(config);
    if (this.mode === 'campaign') this.saveCheckpoint();

    await this.loadBackground(getLevelBackground(this.currentLevel));
  }

  private checkForNewSharks(config: LevelConfig): void {
    const warnings: { name: string; description: string }[] = [];

    for (const k of config.sharkKinds) {
      if (!this.seenSharkKinds.has(k) && SHARK_INTRO_INFO[k]) {
        warnings.push(SHARK_INTRO_INFO[k]!);
      }
      this.seenSharkKinds.add(k);
    }

    if (config.largeSharkCount > 0 && !this.seenLargeSharkVariety) {
      warnings.push({
        name: 'Larger Shark Varieties',
        description: 'Some sharks in these waters are larger and stronger. You will need more dolphins to defeat them.',
      });
      this.seenLargeSharkVariety = true;
    }

    if (config.largeSharkCount > 0) {
      for (const k of config.sharkKinds) {
        if (!this.seenLargeSharkKinds.has(k) && LARGE_SHARK_INTRO_INFO[k]) {
          warnings.push(LARGE_SHARK_INTRO_INFO[k]!);
          this.seenLargeSharkKinds.add(k);
        }
      }
    }

    if (warnings.length > 0) {
      this.showSharkWarning(warnings);
    }
  }

  private showSharkWarning(warnings: { name: string; description: string }[]): void {
    this.awaitingSharkWarning = true;
    this.sharkWarningListEl.innerHTML = '';
    for (const info of warnings) {
      const item = document.createElement('div');
      item.className = 'shark-warning-item';
      const name = document.createElement('strong');
      name.textContent = info.name;
      const desc = document.createElement('p');
      desc.textContent = info.description;
      item.appendChild(name);
      item.appendChild(desc);
      this.sharkWarningListEl.appendChild(item);
    }
    this.sharkWarningOverlayEl.classList.remove('hidden');
  }

  dismissSharkWarning(): void {
    if (!this.awaitingSharkWarning) return;
    this.awaitingSharkWarning = false;
    this.sharkWarningOverlayEl.classList.add('hidden');
    if (this.running && !this.paused) {
      this.lastFrameTime = 0;
      this.step();
    }
  }

  private getPodSize(): number {
    return this.dolphins.filter((d) => d.isPlayer || d.recruited).length;
  }

  private sharkHitRadius(shark: Shark): number {
    if (shark.matriarch) return 10;
    if (shark.kind === 'greatWhite' && shark.large) return 6;
    return 4;
  }

  private sharkPodRequirement(kind: SharkKind, large: boolean): number {
    if (large) {
      if (kind === 'tiger') return 8;
      if (kind === 'greatWhite') return 12;
      if (kind === 'hammerhead') return 10;
    } else {
      if (kind === 'tiger') return 4;
      if (kind === 'greatWhite') return 5;
      if (kind === 'hammerhead') return 4;
    }
    return HUNTING_MODE_POD_SIZE;
  }

  private randomizeSharkSpawnPosition(shark: Shark): void {
    if (!this.player) return;
    let tries = 0;
    do {
      shark._x = Math.floor(Math.random() * SIZE);
      shark._y = Math.floor(Math.random() * SIZE);
      tries += 1;
    } while (
      Math.abs(shark._x - this.player._x) < 15 &&
      Math.abs(shark._y - this.player._y) < 15 &&
      tries < 20
    );
    shark.lastX = shark._x;
    shark.lastY = shark._y;
  }

  private spawnSharksForLevel(config: LevelConfig): void {
    for (const shark of this.sharks) {
      this.removeSharkSprite(shark);
    }
    this.sharks = [];

    let id = 0;
    for (let i = 0; i < config.normalSharkCount; i++) {
      const shark = new Shark(id++);
      shark.kind = config.sharkKinds[Math.floor(Math.random() * config.sharkKinds.length)];
      shark.speedMultiplier = config.sharkSpeedMultiplier * (shark.kind === 'hammerhead' ? HAMMERHEAD_SPEED_BONUS : 1);
      this.randomizeSharkSpawnPosition(shark);
      shark._y = clampEntityY(shark._y, 4);
      this.sharks.push(shark);
      this.addSharkSprite(shark);
    }

    for (let i = 0; i < config.largeSharkCount; i++) {
      const shark = new Shark(id++);
      shark.kind = config.sharkKinds[Math.floor(Math.random() * config.sharkKinds.length)];
      shark.large = true;
      shark.sizeMultiplier = shark.kind === 'tiger' ? 2.5 : LARGE_SHARK_SIZE_MULTIPLIER;
      shark.speedMultiplier = config.sharkSpeedMultiplier * (shark.kind === 'hammerhead' ? HAMMERHEAD_SPEED_BONUS : 1) * (shark.kind === 'greatWhite' ? GREAT_WHITE_LARGE_SPEED_BONUS : 1);
      this.randomizeSharkSpawnPosition(shark);
      const margin = Math.ceil((24 * shark.sizeMultiplier) / (CANVAS_SIZE / SIZE));
      shark._y = clampEntityY(shark._y, margin);
      this.sharks.push(shark);
      this.addSharkSprite(shark);
    }

    this.maxDolphins = config.maxDolphins;
    this.dolphinSpawnInterval = config.level === 10 ? DOLPHIN_SPAWN_INTERVAL / 2 : DOLPHIN_SPAWN_INTERVAL;

    this.matriarch = null;
    this.matriarchWarningShown = false;
    this.matriarchSmallCleared = false;
    this.matriarchSpawnerTimer = 0;
    if (config.matriarch) {
      this.matriarchWarningTime = this.gameTime + 25;
      this.matriarchSpawnTime = this.gameTime + 30;
    } else {
      this.matriarchWarningTime = 0;
      this.matriarchSpawnTime = 0;
    }

    if (this.huntingMode) this.onSchoolingChange?.(false);
    this.huntingMode = false;
    this.readyToSchool = false;
    this.schoolBtnWrap.classList.add('hidden');
    this.updateHuntingVisuals();
    this.updateSharkGuide(config);
  }

  private spawnMatriarch(): void {
    const shark = new Shark(this.sharks.length);
    shark.kind = 'greatWhite';
    shark.large = true;
    shark.matriarch = true;
    shark.sizeMultiplier = LARGE_SHARK_SIZE_MULTIPLIER * 2;
    shark.speedMultiplier = 0.5;
    shark._x = SIZE + 15;
    shark._y = Math.floor(Math.random() * (SIZE - 8)) + 4;
    shark.lastX = shark._x;
    shark.lastY = shark._y;
    this.matriarch = shark;
    this.sharks.push(shark);
    this.addSharkSprite(shark);
    this.setStatus('Matriarch has arrived!');
    this.showBanner('Matriarch!', 'storm', 2500);
  }

  private spawnMatriarchShark(): void {
    const shark = new Shark(this.sharks.length);
    shark.kind = 'greatWhite';
    shark.large = true;
    shark.sizeMultiplier = LARGE_SHARK_SIZE_MULTIPLIER;
    shark.speedMultiplier = 1.25;
    shark._x = SIZE + 15;
    shark._y = Math.floor(Math.random() * (SIZE - 8)) + 4;
    shark.lastX = shark._x;
    shark.lastY = shark._y;
    this.sharks.push(shark);
    this.addSharkSprite(shark);
    this.setStatus('The Matriarch calls a great white');
  }

  private updateSharkGuide(config: LevelConfig): void {
    this.sharkGuideList.innerHTML = config.sharkKinds
      .map((kind) => {
        const name = SHARK_INTRO_INFO[kind]?.name ?? kind[0].toUpperCase() + kind.slice(1);
        const small = `<li><span>${name} (small)</span><span>${this.sharkPodRequirement(kind, false)}</span></li>`;
        const large = config.largeSharkCount > 0 ? `<li><span>${name} (large)</span><span>${this.sharkPodRequirement(kind, true)}</span></li>` : '';
        return small + large;
      })
      .join('');
  }

  private clearJellyfish(): void {
    this.jellyfishContainer.removeChildren();
    this.jellyfishSprites.clear();
    this.jellyfish = [];
  }

  private startJellyfishSwarm(): void {
    this.activeEvent = { type: 'jellyfish', endsAt: this.gameTime + JELLYFISH_SWARM_DURATION };
    this.clearJellyfish();
    for (let i = 0; i < JELLYFISH_COUNT; i++) {
      const y = 2 + Math.random() * (SIZE - 4);
      const jelly = new Jellyfish(i, y);
      this.jellyfish.push(jelly);
      const sprite = createJellyfishSprite();
      this.jellyfishContainer.addChild(sprite);
      this.jellyfishSprites.set(jelly, sprite);
    }
    this.setStatus('Jellyfish swarm! Navigate through');
    this.showBanner('Jellyfish Swarm!', 'storm', 2500);
    if (this.disbandBtnWrap) this.disbandBtnWrap.classList.remove('hidden');
  }

  private endJellyfishSwarm(): void {
    this.disbanded = false;
    if (this.disbandBtnWrap) this.disbandBtnWrap.classList.add('hidden');
    if (this.originalPlayer && this.dolphins.includes(this.originalPlayer)) {
      if (this.player && this.player !== this.originalPlayer) this.player.isPlayer = false;
      this.originalPlayer.isPlayer = true;
      this.player = this.originalPlayer;
    }
    this.originalPlayer = null;
    this.clearJellyfish();
    this.activeEvent = null;
    this.setStatus('The swarm has passed');
  }

  private updateJellyfish(): void {
    const alive: Jellyfish[] = [];
    const allPast = this.dolphins.length > 0 && this.dolphins.every((d) => d._x > 70);
    const speedFactor = allPast ? 2 : 1;
    for (const jelly of this.jellyfish) {
      jelly._x -= jelly.speed * speedFactor;
      if (jelly._x > -10) {
        alive.push(jelly);
      } else {
        const sprite = this.jellyfishSprites.get(jelly);
        if (sprite) {
          this.jellyfishContainer.removeChild(sprite);
          sprite.destroy();
          this.jellyfishSprites.delete(jelly);
        }
      }
    }
    this.jellyfish = alive;
  }

  private drawJellyfish(): void {
    const scale = CANVAS_SIZE / SIZE;
    for (const [jelly, sprite] of this.jellyfishSprites) {
      sprite.x = jelly._x * scale + scale / 2;
      sprite.y = jelly._y * scale + scale / 2;
    }
  }

  private startEvent(type: GameEventType): void {
    this.activeEvent = { type, endsAt: this.gameTime + EVENT_DURATION };
    if (type === 'storm') {
      this.setStatus('A storm rolls in: visibility reduced');
      this.showBanner('Storm Incoming!', 'storm', 2500);
      sfx.startStormRumble();
    }
  }

  private endEvent(): void {
    if (this.activeEvent?.type === 'storm') {
      this.setStatus('The storm has passed');
      this.showBanner('Storm Passed', 'storm', 2000);
      this.stormOverlay.clear();
      sfx.stopStormRumble();
    } else if (this.activeEvent?.type === 'jellyfish') {
      this.endJellyfishSwarm();
      return;
    }
    this.activeEvent = null;
  }

  private planNextEvent(): void {
    const roll = Math.random();
    if (roll < EVENT_CHANCE * 2) {
      if (this.currentLevel <= 5) {
        this.pendingEvent = Math.random() < 0.5 ? 'storm' : 'jellyfish';
      } else {
        this.pendingEvent = 'storm';
      }
    } else {
      this.pendingEvent = null;
    }
    this.nextStormWarningTime = this.nextEventCheckTime - 5;
    this.stormWarningShown = false;
  }

  private updateEvents(): void {
    if (this.activeEvent) {
      if (this.gameTime >= this.activeEvent.endsAt) this.endEvent();
      return;
    }
    if (this.gameTime >= this.nextEventCheckTime) {
      if (this.pendingEvent === 'storm') {
        this.startEvent('storm');
      } else if (this.pendingEvent === 'jellyfish') {
        this.startJellyfishSwarm();
      }
      this.nextEventCheckTime += EVENT_CHECK_INTERVAL;
      this.planNextEvent();
    } else if (this.pendingEvent === 'storm' && this.gameTime >= this.nextStormWarningTime && !this.stormWarningShown) {
      this.stormWarningShown = true;
      this.setStatus('Storm approaching in 5 seconds');
    }
  }

  private updateMatriarch(): void {
    if (this.matriarchSpawnTime === 0) return;
    if (!this.matriarchWarningShown && this.gameTime >= this.matriarchWarningTime) {
      this.matriarchWarningShown = true;
      this.setStatus('Matriarch approaching in 5 seconds');
      this.showBanner('Matriarch Approaching!', 'storm', 2500);
    }
    if (!this.matriarch && this.gameTime >= this.matriarchSpawnTime) {
      this.spawnMatriarch();
    }
    if (this.matriarch) {
      const smallRemaining = this.sharks.some((s) => s !== this.matriarch && !s.large);
      if (!smallRemaining) {
        if (!this.matriarchSmallCleared) {
          this.matriarchSmallCleared = true;
          this.matriarchSpawnerTimer = this.gameTime + 20;
        } else if (this.gameTime >= this.matriarchSpawnerTimer) {
          this.spawnMatriarchShark();
          this.matriarchSpawnerTimer = this.gameTime + 20;
        }
      }
    }
  }

  private movePlayer(): void {
    if (!this.player) return;
    const boosted = Date.now() < this.player.speedBoostUntil;
    const speed = (boosted ? 4 : 2) * (1 + this.speedBonusPct) * (this.sprinting ? SPRINT_SPEED : 1);
    let dx = 0;
    let dy = 0;

    if (this.pointerActive) {
      const deadZone = 0.08;
      if (Math.abs(this.pointerDirX) > deadZone) dx = Math.sign(this.pointerDirX);
      if (Math.abs(this.pointerDirY) > deadZone) dy = Math.sign(this.pointerDirY);
    } else {
      if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) dy = -1;
      if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) dy = 1;
      if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) dx = -1;
      if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) dx = 1;
    }

    if (dx !== 0 || dy !== 0) {
      const rawX = this.player._x + dx * speed;
      if (this.awaitingNewWaters && dx > 0 && rawX >= SIZE) {
        this.player._x = 2;
        this.player.lastX = 2;
        this.advanceLevel().catch((err) => console.warn('Level transition failed:', err));
      } else {
        this.player._x = wrapX(rawX);
      }
      this.player._y = clampEntityY(this.player._y + dy * speed, 2);
    }
  }

  private findFreeSpot(): { x: number; y: number } {
    let x: number, y: number;
    do {
      x = Math.floor(Math.random() * SIZE);
      y = Math.floor(Math.random() * SIZE);
    } while (this.player && Math.abs(x - this.player._x) < 10 && Math.abs(y - this.player._y) < 10);
    return { x, y };
  }

  private spawnMagicShrimp(): void {
    const spot = this.findFreeSpot();
    this.magicShrimp = new MagicShrimp();
    this.magicShrimp._x = spot.x;
    this.magicShrimp._y = clampEntityY(spot.y, 3);
    this.shrimpSpawned = true;
    this.addShrimpSprite();
    this.setStatus('Magic shrimp appeared!');
  }

  private checkShrimpCollection(): void {
    if (!this.magicShrimp) return;
    const scale = CANVAS_SIZE / SIZE;
    const shrimpX = this.magicShrimp._x * scale + scale / 2;
    const shrimpY = this.magicShrimp._y * scale + scale / 2;

    for (const dolphin of this.dolphins) {
      if (!dolphin.isPlayer) continue;
      if (dolphin.distanceBetween(this.magicShrimp) <= 4) {
        dolphin.speedBoostUntil = Number.MAX_SAFE_INTEGER;
        this.setStatus('Speed boost for the level!');
        this.particles.emit('sparkle', shrimpX, shrimpY, 16, { speed: 2, life: 0.8 });
        sfx.playShrimp();
        this.magicShrimp = null;
        if (this.shrimpSprite) {
          this.entityContainer.removeChild(this.shrimpSprite);
          this.shrimpSprite.destroy();
          this.shrimpSprite = null;
        }
        return;
      }
    }

    for (const shark of this.sharks) {
      if (shark.distanceBetween(this.magicShrimp) <= 4) {
        shark.large = true;
        shark.sizeMultiplier = shark.kind === 'tiger' ? 2.5 : LARGE_SHARK_SIZE_MULTIPLIER;
        this.setStatus('A shark grew to full size!');
        this.particles.emit('sparkle', shrimpX, shrimpY, 16, { speed: 2, life: 0.8 });
        this.magicShrimp = null;
        if (this.shrimpSprite) {
          this.entityContainer.removeChild(this.shrimpSprite);
          this.shrimpSprite.destroy();
          this.shrimpSprite = null;
        }
        return;
      }
    }
  }

  private step(): void {
    if (!this.running || this.awaitingLevelUpChoice || this.awaitingSharkWarning) return;

    const sharkSpeed = parseInt(this.sharkSpeedInput.value, 10) || 1;

    const now = Date.now();
    if (now >= this.sprintEndTime) this.sprinting = false;
    if (this.keys[' '] && now >= this.sprintCooldownEnd) {
      this.sprinting = true;
      this.sprintEndTime = now + SPRINT_DURATION;
      this.sprintCooldownEnd = now + SPRINT_DURATION + Math.max(3000, SPRINT_COOLDOWN - this.sprintCooldownReduction);
      this.setStatus('Sprint!');
      this.showBanner('Sprint!', 'victory', 800);
    }

    this.movePlayer();
    for (const dolphin of this.dolphins) {
      if (!dolphin.isPlayer && !dolphin.recruited) dolphin.move(this.sharks);
    }
    this.moveFollowers();

    if (this.activeEvent?.type !== 'jellyfish') {
      for (const shark of this.sharks) {
        const unlimitedRange = shark.kind === 'greatWhite' || shark.kind === 'hammerhead';
        shark.move(sharkSpeed, this.player, this.sharks, unlimitedRange, now);
      }
    }

    if (this.player) {
      for (const dolphin of this.dolphins) {
        if (dolphin.isPlayer || dolphin.recruited) continue;
        if (this.dolphins.some((d) => (d.isPlayer || d.recruited) && d.distanceBetween(dolphin) <= 4)) {
          dolphin.recruited = true;
          this.totalRecruited++;
          this.setStatus('Dolphin recruited');
          this.showBanner('Dolphin Recruited!', 'recruited', 2000);
          sfx.playRecruit();
          break;
        }
      }
    }

    const scale = CANVAS_SIZE / SIZE;

    const canSchool = this.getPodSize() >= HUNTING_MODE_POD_SIZE;

    if (this.huntingMode && !canSchool) {
      this.huntingMode = false;
      this.setStatus('Hunting mode lost');
      this.updateHuntingVisuals();
      this.onSchoolingChange?.(false);
    }

    if (canSchool && !this.huntingMode && !this.readyToSchool) {
      this.readyToSchool = true;
      this.schoolBtnWrap.classList.remove('hidden');
      this.setStatus('Pod ready! Tap Form Pod to hunt sharks');
    } else if (!canSchool && this.readyToSchool) {
      this.readyToSchool = false;
      this.schoolBtnWrap.classList.add('hidden');
    }

    if (!this.autoFormedThisLevel && this.player && this.player.invulnerableUntil <= Date.now() && canSchool && !this.huntingMode) {
      this.autoFormedThisLevel = true;
      this.formSchool();
      this.setStatus('Pod Formed');
      this.showBanner('Pod Formed!', 'victory', 1500);
    }

    if (this.activeEvent?.type !== 'jellyfish' && this.huntingMode) {
      const survivingSharks: Shark[] = [];
      for (const shark of this.sharks) {
        const hitRadius = this.sharkHitRadius(shark);
        const hitsAnyDolphin = this.dolphins.some((d) => shark.distanceBetween(d) < hitRadius);
        const canDestroy = hitsAnyDolphin && this.getPodSize() >= this.sharkPodRequirement(shark.kind, shark.large);
        if (!canDestroy) {
          survivingSharks.push(shark);
        } else {
          this.particles.emit('hit', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 16, { speed: 3, life: 0.6 });
          this.sharksKilled++;
          this.removeSharkSprite(shark);
        }
      }
      this.sharks = survivingSharks;
      if (this.sharks.length === 0 && !this.levelCompleted) {
        this.levelComplete();
      } else if (this.matriarch && !this.sharks.includes(this.matriarch) && !this.levelCompleted) {
        this.sharksKilled += this.sharks.length;
        for (const s of this.sharks) this.removeSharkSprite(s);
        this.sharks = [];
        this.levelComplete();
      }
    }

    if (this.activeEvent?.type !== 'jellyfish') {
      if (this.player && now >= this.playerHitCooldownUntil && now >= this.player.invulnerableUntil) {
        for (const shark of this.sharks) {
          if (shark.distanceBetween(this.player) < this.sharkHitRadius(shark)) {
            sfx.playBite();
            let victim: Dolphin | undefined;
            for (let i = this.dolphins.length - 1; i >= 0; i--) {
              const candidate = this.dolphins[i];
              if (!candidate.isPlayer && candidate.recruited && now >= candidate.invulnerableUntil) {
                victim = candidate;
                break;
              }
            }
            if (victim) {
              this.playerHitCooldownUntil = now + 1000;
              this.particles.emit('hit', victim._x * scale + scale / 2, victim._y * scale + scale / 2, 12, { speed: 2, life: 0.6 });
              this.removeDolphinSprite(victim);
              this.dolphins = this.dolphins.filter((d) => d !== victim);
              this.totalLost++;
              this.setStatus('A dolphin was lost');
              this.showBanner('Dolphin Lost!', 'lost', 2000);
            } else if (this.vitalityLives > 0) {
              this.vitalityLives -= 1;
              this.playerHitCooldownUntil = now + 1000;
              this.player.invulnerableUntil = now + 3000;
              this.setStatus('Extra life used!');
              this.showBanner('Extra Life!', 'recruited', 2000);
            } else {
              this.gameOver();
              return;
            }
            break;
          }
        }
      }
    }

    if (this.activeEvent?.type === 'jellyfish' && this.player) {
      for (const jelly of this.jellyfish) {
        let victim: Dolphin | undefined;
        for (const d of this.dolphins) {
          if (!d.isPlayer && !d.recruited) continue;
          if (jelly.distanceBetween(d) < 2.5) {
            victim = d;
            break;
          }
        }
        if (!victim) continue;
        if (victim.isPlayer && (now < this.playerHitCooldownUntil || now < this.player.invulnerableUntil)) continue;
        if (victim.isPlayer) this.playerHitCooldownUntil = now + 1000;
        sfx.playBite();
        if (victim.isPlayer) {
          if (this.vitalityLives > 0) {
            this.vitalityLives -= 1;
            this.player.invulnerableUntil = now + 3000;
            this.setStatus('Sting resisted!');
            this.showBanner('Extra Life!', 'recruited', 2000);
          } else {
            this.gameOver();
            return;
          }
        } else {
          this.particles.emit('hit', victim._x * scale + scale / 2, victim._y * scale + scale / 2, 12, { speed: 2, life: 0.6 });
          this.removeDolphinSprite(victim);
          this.dolphins = this.dolphins.filter((d) => d !== victim);
          this.totalLost++;
          this.setStatus('A dolphin was stung');
          this.showBanner('Dolphin Stung!', 'lost', 2000);
        }
        break;
      }
    }

    const dt = this.lastFrameTime === 0 ? 0 : (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (this.startTime === 0) this.startTime = now;
    this.gameTime = (now - this.startTime) / 1000;

    this.updateEvents();
    this.updateMatriarch();

    if (this.activeEvent?.type === 'jellyfish') {
      this.updateJellyfish();
    }

    if (this.gameTime >= this.nextDolphinSpawnTime && this.dolphins.length < this.maxDolphins) {
      const hasStray = this.dolphins.some((d) => !d.isPlayer && !d.recruited);
      if (!hasStray) {
        this.spawnRecruitableDolphin();
        this.nextDolphinSpawnTime += this.dolphinSpawnInterval;
      }
    }

    this.bubbleTimer += dt;
    if (this.bubbleTimer > 0.25) {
      this.bubbleTimer = 0;
      const bx = Math.random() * CANVAS_SIZE;
      this.particles.emitDirected('bubble', bx, CANVAS_SIZE, 1, 0, -1, { speed: 0.8 + Math.random() * 1.2, life: 2 + Math.random() * 2 });
    }

    if (this.player && dt > 0) {
      if (Math.random() < 0.5) {
        this.particles.emit('wake', this.player._x * scale + scale / 2, this.player._y * scale + scale / 2, 1, { speed: 0.6, life: 0.4 });
      }
    }
    for (const dolphin of this.dolphins) {
      if (dolphin.isPlayer) continue;
      if (Math.random() < 0.18) {
        this.particles.emit('wake', dolphin._x * scale + scale / 2, dolphin._y * scale + scale / 2, 1, { speed: 0.5, life: 0.35 });
      }
    }
    for (const shark of this.sharks) {
      if (Math.random() < 0.12) {
        this.particles.emit('wake', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 1, { speed: 0.7, life: 0.45 });
      }
    }

    if (!this.shrimpSpawned && this.gameTime >= 80) {
      this.spawnMagicShrimp();
    }

    this.checkShrimpCollection();

    this.particles.update(dt);
    this.draw();
    this.updateStats();

    for (const dolphin of this.dolphins) {
      dolphin.lastX = dolphin._x;
      dolphin.lastY = dolphin._y;
    }
    for (const shark of this.sharks) {
      shark.lastX = shark._x;
      shark.lastY = shark._y;
    }

    const speed = parseInt(this.speedInput.value, 10) || 80;
    this.timer = setTimeout(() => this.step(), speed);
  }

  private updateStats(): void {
    this.statTime.textContent = this.gameTime.toFixed(1) + 's';
    const spawnCount = Math.max(0, this.nextDolphinSpawnTime - this.gameTime);
    this.statSpawn.textContent = spawnCount.toFixed(1) + 's';
    const shrimpCount = Math.max(0, 80 - this.gameTime);
    this.statShrimp.textContent = this.magicShrimp
      ? 'On the board!'
      : this.shrimpSpawned
      ? 'Gone'
      : shrimpCount.toFixed(1) + 's';
    this.statDolphins.textContent = String(this.dolphins.length);
    this.statSharks.textContent = String(this.sharks.length);
    this.updateLastLifeHeart();
  }

  private updateLastLifeHeart(): void {
    if (!this.lastLifeHeart) return;
    if (this.getPodSize() <= 1) {
      const lives = 1 + this.vitalityLives;
      this.lastLifeHeart.textContent = '❤️'.repeat(lives);
      this.lastLifeHeart.classList.remove('hidden');
    } else {
      this.lastLifeHeart.classList.add('hidden');
      this.lastLifeHeart.textContent = '❤️';
    }
  }

  private draw(): void {
    const scale = CANVAS_SIZE / SIZE;
    const t = this.gameTime || 0;

    const now = Date.now();

    for (const [dolphin, sprite] of this.dolphinSprites) {
      sprite.x = dolphin._x * scale + scale / 2;
      sprite.y = dolphin._y * scale + scale / 2;

      const fish = sprite.getChildByName('fish') as Container;
      const tail = fish.getChildByName('tail') as Container;
      tail.rotation = Math.sin(t * 12 + dolphin.id) * 0.35;

      const dx = directionDelta(dolphin._x, dolphin.lastX);
      if (Math.abs(dx) > 0.01) {
        const dir = dx > 0 ? 1 : -1;
        fish.scale.set(dir, 1);
      }

      const boosted = now < dolphin.speedBoostUntil;
      const invulnerable = now < dolphin.invulnerableUntil;
      const boostRing = sprite.getChildByName('boostRing') as Graphics;
      const invulRing = sprite.getChildByName('invulRing') as Graphics;

      boostRing.clear();
      if (boosted) {
        boostRing.circle(0, 0, 14).stroke({ width: 2, color: 0xfacc15, alpha: 1 });
      }

      invulRing.clear();
      if (invulnerable) {
        invulRing.circle(0, 0, 14).stroke({ width: 2, color: 0xa855f7, alpha: 1 });
      }
    }

    for (const [shark, sprite] of this.sharkSprites) {
      sprite.x = shark._x * scale + scale / 2;
      sprite.y = shark._y * scale + scale / 2;

      const fish = sprite.getChildByName('fish') as Container;
      const baseScale = SHARK_BASE_SCALE * SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;

      const dx = this.player ? directionDelta(this.player._x, shark._x) : directionDelta(shark._x, shark.lastX);
      if (Math.abs(dx) > 0.3) {
        const dir = dx > 0 ? 1 : -1;
        fish.scale.set(baseScale * dir, baseScale);
      } else {
        const dirSign = fish.scale.x >= 0 ? 1 : -1;
        fish.scale.set(baseScale * dirSign, baseScale);
      }

      if (fish instanceof SharkFishSprite) {
        const closeToDolphin = this.dolphins.some((d) => shark.distanceBetween(d) < SHARK_ATTACK_TRIGGER_RADIUS);
        fish.setAttacking(closeToDolphin);
      }

      const reqText = sprite.getChildByName('reqText') as Text;
      if (reqText) {
        const req = this.sharkPodRequirement(shark.kind, shark.large);
        const canDestroy = this.getPodSize() >= req;
        reqText.text = String(req);
        reqText.style.fill = canDestroy ? '#22c55e' : '#ef4444';
        reqText.y = -40 * baseScale;
      }

      const glow = sprite.getChildByName('glow') as Sprite;
      glow.width = 48 * SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;
      glow.height = 48 * SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;

      if (this.activeEvent?.type === 'storm' && this.player) {
        sprite.visible = shark.distanceBetween(this.player) <= STORM_VISIBILITY_RADIUS;
      } else {
        sprite.visible = true;
      }
    }

    if (this.magicShrimp && this.shrimpSprite) {
      const pulse = 1 + Math.sin(t * 6) * 0.12;
      this.shrimpSprite.x = this.magicShrimp._x * scale + scale / 2;
      this.shrimpSprite.y = this.magicShrimp._y * scale + scale / 2;
      this.shrimpSprite.scale.set(pulse);
    }

    this.drawJellyfish();

    this.stormOverlay.clear();
    if (this.activeEvent?.type === 'storm') {
      this.stormOverlay.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE).fill({ color: 0x0b1225, alpha: 0.5 });
    }
  }
}
