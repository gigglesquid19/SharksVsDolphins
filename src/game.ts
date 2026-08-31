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
  makeDolphinBodyCanvas,
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
import { hasSeenHint, markHintSeen, HintId } from './tutorialHints';
import { AMBIENT_TRACKS, BOSS_TRACKS, pickRandomTrack } from './music';
import { ACHIEVEMENTS, AchievementId, getUnlockedMap, unlock } from './achievements';
import { bumpLifetime, recordPlayDay } from './lifetimeStats';
import {
  awardPearls,
  getPearls,
  pearlsForLevel,
  PEARLS_CAMPAIGN_CLEAR,
  PEARLS_FLAWLESS_CAMPAIGN_BONUS,
} from './pearls';
import { getDolphinName } from './profile';
import { endlessStartBonuses, equippedSkinId, grantSkin, ownsSkin } from './store';
import { skinById } from './skins';
import { shareMilestone, SHARE_REWARD_SKIN } from './share';
import { playGames } from './playGames';
import { isAndroid } from './platform';
import { ads } from './ads';
import { iap } from './iap';

export type GameMode = 'campaign' | 'endless';
type LeaderboardBoard = 'campaign' | 'endless';

// '/' for the app and dev, '/SharksVsDolphins/' for the GitHub Pages build - so
// public/ assets loaded at runtime resolve under whatever sub-path is in use.
const ASSET_BASE = import.meta.env.BASE_URL;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const DOLPHIN_SPAWN_INTERVAL = 15;
const EVENT_CHECK_INTERVAL = 60;
const EVENT_CHANCE = 0.1;
const EVENT_DURATION = 30;
const JELLYFISH_SWARM_DURATION = 45;
const JELLYFISH_COUNT = 50;
const STORM_VISIBILITY_RADIUS = 18;
const HUNTING_MODE_POD_SIZE = 4;
const MATRIARCH_HITS_REQUIRED = 3;
const MATRIARCH_HIT_COOLDOWN_MS = 900;
const LARGE_SHARK_SIZE_MULTIPLIER = 1.8;
const SPRINT_DURATION = 300;
const SPRINT_COOLDOWN = 10000;
const SPRINT_SPEED = 2;
// Game-feel: a brief freeze-frame and a light screen shake on large-shark kills.
const HIT_STOP_MS = 70;
const SHAKE_MAGNITUDE = 3.5;
const SHAKE_DURATION_MS = 200;
const COMBO_RESET_SECONDS = 2.5;
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
    description: 'Older Great Whites grow far larger - it takes a big pod and a Boost dash to bring one down.',
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
  /** Orientation of the pod formation, in radians - eased toward the player's heading. */
  private podHeading = 0;
  private dolphinSpawnInterval = DOLPHIN_SPAWN_INTERVAL;

  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Seconds of actual play in the current level attempt (resets on retry). Drives spawn /
   * event timers and the on-screen clock. Advances only while step() runs, so time spent on
   * a pause / overlay does not count. */
  private gameTime = 0;
  /** Seconds of actual play across the whole run - survives retries and level transitions,
   * resets only on a fresh start. This is the leaderboard time. */
  private runElapsed = 0;
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
  private matriarchEnraged = false;
  private levelCompleted = false;
  private levelCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingNewWaters = false;
  private awaitingLevelUpChoice = false;
  private awaitingSharkWarning = false;
  private awaitingRunSummary = false;
  private awaitingTutorialHint = false;
  /** The Endless "Level 50!" share overlay is open (gates the loop like the other awaiting* flags). */
  private awaitingMilestone = false;
  /** Set when level 50 is cleared in Endless, so the levelComplete timer shows the milestone overlay. */
  private pendingMilestone = false;
  /** The Android "Continue your run?" offer is open (gates the loop). */
  private awaitingContinue = false;
  /** One paid/ad Continue per Endless run. */
  private continueUsedThisRun = false;
  /** Endless deaths this session, for the every-3rd interstitial (Android). */
  private endlessDeaths = 0;
  /** Achievement ids unlocked during the current run, for the run-summary card. */
  private achievementsThisRun: string[] = [];
  private hintQueue: { heading: string; text: string }[] = [];
  private seenSharkKinds = new Set<SharkKind>();
  private seenLargeSharkKinds = new Set<SharkKind>();
  private seenLargeSharkVariety = false;
  private autoFormedThisLevel = false;
  private currentLevel = 1;
  private retries = 0;
  private totalRecruited = 0;
  private totalLost = 0;
  private sharksKilled = 0;
  private lostThisLevel = 0;
  private sessionStartTime = 0;
  // Lifetime-achievement bookkeeping (see flushLifetimeStats / src/lifetimeStats.ts).
  private syncedSharkKills = 0;
  private lastBoostNudgeTime = 0;
  private unsyncedPlaySeconds = 0;
  private lifetimeFlushAt = 0;
  private playDayRecorded = false;
  private wasOnLastLifeThisLevel = false;
  private lostAtSwarmStart = 0;
  private achievementQueue: { icon: string; name: string }[] = [];
  private sprinting = false;
  private sprintEndTime = 0;
  private sprintCooldownEnd = 0;
  private sprintCooldownReduction = 0;
  /** Extra sprint duration in ms from the Store's Boost Duration upgrade (Endless only). */
  private sprintDurationBonus = 0;
  // Game feel: hit-stop freezes the sim until this time; the shake jitters the Pixi stage.
  private hitStopUntil = 0;
  private shakeTime = 0;
  private shakeMagnitude = 0;
  /** Consecutive shark kills; drives the rising combo pitch. Resets after a gap / dolphin loss / level. */
  private killCombo = 0;
  private lastKillTime = 0;
  private reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private vitalityLives = 0;
  private speedBonusPct = 0;
  private charismaBonusDolphins = 0;
  private totalDolphinsSaved = 0;
  private megaPodAvailable = false;
  private megaPodActive = false;
  private matriarchHitsTaken = 0;
  private matriarchHitCooldownUntil = 0;
  private mode: GameMode = 'campaign';
  private currentLeaderboardBoard: LeaderboardBoard = 'campaign';
  private pendingScore:
    | { board: 'campaign'; score: Omit<NewCampaignScore, 'name'> }
    | { board: 'endless'; score: Omit<NewEndlessScore, 'name'> }
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
  private dolphinsSavedBadgeEl: HTMLElement | null = null;
  private dolphinsSavedNumberEl: HTMLElement | null = null;
  private pearlsNumberEl: HTMLElement | null = null;
  /** Pearls earned in the current run, shown on the run-summary card. */
  private pearlsThisRun = 0;
  private startWithPodCheckbox: HTMLInputElement | null = null;
  private startWith8PodCheckbox: HTMLInputElement | null = null;
  private bannerEl: HTMLDivElement;
  private bannerTimeout: ReturnType<typeof setTimeout> | null = null;
  private newWatersPromptEl: HTMLDivElement;
  private pauseOverlayEl: HTMLDivElement;
  private schoolBtnWrap: HTMLDivElement;
  private megaPodBtnWrap: HTMLDivElement | null = null;
  private levelSelect: HTMLSelectElement | null = null;
  private leaderboardOverlayEl: HTMLDivElement | null = null;
  private leaderboardListEl: HTMLElement | null = null;
  private leaderboardHeadEl: HTMLElement | null = null;
  private leaderboardHeadingEl: HTMLElement | null = null;
  private leaderboardTabCampaignBtn: HTMLButtonElement | null = null;
  private leaderboardTabEndlessBtn: HTMLButtonElement | null = null;
  private leaderboardGlobalEl: HTMLElement | null = null;
  private leaderboardGlobalRankEl: HTMLElement | null = null;
  private leaderboardGlobalBtn: HTMLButtonElement | null = null;
  private leaderboardSignInBtn: HTMLButtonElement | null = null;
  private runSummaryOverlayEl: HTMLDivElement | null = null;
  private runSummaryTitleEl: HTMLElement | null = null;
  private runSummaryNameEl: HTMLElement | null = null;
  private runSummaryStatsEl: HTMLElement | null = null;
  private runSummaryAchievementsEl: HTMLElement | null = null;
  private runSummaryShareBtnEl: HTMLButtonElement | null = null;
  private runSummaryHomeBtnEl: HTMLButtonElement | null = null;
  private milestoneOverlayEl: HTMLDivElement | null = null;
  private milestoneTextEl: HTMLElement | null = null;
  private milestoneRewardEl: HTMLElement | null = null;
  private continueOverlayEl: HTMLDivElement | null = null;
  private continueDepthEl: HTMLElement | null = null;
  private continueAdBtnEl: HTMLButtonElement | null = null;
  private continuePayBtnEl: HTMLButtonElement | null = null;
  private gameOverOverlayEl: HTMLDivElement | null = null;
  private tutorialHintOverlayEl: HTMLDivElement | null = null;
  private tutorialHintHeadingEl: HTMLElement | null = null;
  private tutorialHintTextEl: HTMLElement | null = null;
  private megaShrimpHintEl: HTMLElement | null = null;
  private achievementToastEl: HTMLElement | null = null;
  private achievementToastIconEl: HTMLElement | null = null;
  private achievementToastNameEl: HTMLElement | null = null;
  private achievementToastTimeout: ReturnType<typeof setTimeout> | null = null;
  private achievementsOverlayEl: HTMLDivElement | null = null;
  private achievementsListEl: HTMLElement | null = null;
  private levelUpOverlayEl: HTMLDivElement;
  private sharkWarningOverlayEl: HTMLDivElement;
  private sharkWarningListEl: HTMLDivElement;
  private onSchoolingChange?: (active: boolean) => void;
  private onMusicTrackChange?: (url: string) => void;
  private lastMusicLevel = 0;
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
      onMusicTrackChange?: (url: string) => void;
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
    this.megaPodBtnWrap = document.getElementById('megaPodBtnWrap') as HTMLDivElement | null;
    this.levelSelect = document.getElementById('levelSelect') as HTMLSelectElement | null;
    this.leaderboardOverlayEl = document.getElementById('leaderboardOverlay') as HTMLDivElement | null;
    this.leaderboardListEl = document.getElementById('leaderboardList') as HTMLElement | null;
    this.leaderboardHeadEl = document.getElementById('leaderboardHead') as HTMLElement | null;
    this.leaderboardHeadingEl = document.getElementById('leaderboardHeading') as HTMLElement | null;
    this.leaderboardTabCampaignBtn = document.getElementById('leaderboardTabCampaign') as HTMLButtonElement | null;
    this.leaderboardTabEndlessBtn = document.getElementById('leaderboardTabEndless') as HTMLButtonElement | null;
    this.leaderboardTabCampaignBtn?.addEventListener('click', () => this.showLeaderboard('campaign'));
    this.leaderboardTabEndlessBtn?.addEventListener('click', () => this.showLeaderboard('endless'));
    this.leaderboardGlobalEl = document.getElementById('leaderboardGlobal');
    this.leaderboardGlobalRankEl = document.getElementById('leaderboardGlobalRank');
    this.leaderboardGlobalBtn = document.getElementById('leaderboardGlobalBtn') as HTMLButtonElement | null;
    this.leaderboardSignInBtn = document.getElementById('leaderboardSignInBtn') as HTMLButtonElement | null;
    this.leaderboardGlobalBtn?.addEventListener('click', () => void playGames.open(this.currentLeaderboardBoard));
    this.leaderboardSignInBtn?.addEventListener('click', async () => {
      await playGames.signIn();
      this.showLeaderboard(this.currentLeaderboardBoard);
    });
    this.runSummaryOverlayEl = document.getElementById('runSummaryOverlay') as HTMLDivElement | null;
    this.runSummaryTitleEl = document.getElementById('runSummaryTitle');
    this.runSummaryNameEl = document.getElementById('runSummaryName');
    this.runSummaryStatsEl = document.getElementById('runSummaryStats');
    this.runSummaryAchievementsEl = document.getElementById('runSummaryAchievements');
    this.runSummaryShareBtnEl = document.getElementById('runSummaryShareBtn') as HTMLButtonElement | null;
    this.runSummaryHomeBtnEl = document.getElementById('runSummaryHomeBtn') as HTMLButtonElement | null;
    this.milestoneOverlayEl = document.getElementById('milestoneOverlay') as HTMLDivElement | null;
    this.milestoneTextEl = document.getElementById('milestoneText');
    this.milestoneRewardEl = document.getElementById('milestoneReward');
    this.continueOverlayEl = document.getElementById('continueOverlay') as HTMLDivElement | null;
    this.continueDepthEl = document.getElementById('continueDepth');
    this.continueAdBtnEl = document.getElementById('continueAdBtn') as HTMLButtonElement | null;
    this.continuePayBtnEl = document.getElementById('continuePayBtn') as HTMLButtonElement | null;
    this.gameOverOverlayEl = document.getElementById('gameOverOverlay') as HTMLDivElement | null;
    this.tutorialHintOverlayEl = document.getElementById('tutorialHintOverlay') as HTMLDivElement | null;
    this.tutorialHintHeadingEl = document.getElementById('tutorialHintHeading') as HTMLElement | null;
    this.tutorialHintTextEl = document.getElementById('tutorialHintText') as HTMLElement | null;
    this.megaShrimpHintEl = document.getElementById('megaShrimpHint') as HTMLElement | null;
    this.achievementToastEl = document.getElementById('achievementToast') as HTMLElement | null;
    this.achievementToastIconEl = document.getElementById('achievementToastIcon') as HTMLElement | null;
    this.achievementToastNameEl = document.getElementById('achievementToastName') as HTMLElement | null;
    this.achievementsOverlayEl = document.getElementById('achievementsOverlay') as HTMLDivElement | null;
    this.achievementsListEl = document.getElementById('achievementsList') as HTMLElement | null;
    this.levelUpOverlayEl = inputs.levelUpOverlay;
    this.sharkWarningOverlayEl = inputs.sharkWarningOverlay;
    this.sharkWarningListEl = inputs.sharkWarningList;
    this.onSchoolingChange = inputs.onSchoolingChange;
    this.onMusicTrackChange = inputs.onMusicTrackChange;
    this.lastLifeHeart = document.getElementById('lastLifeHeart');
    this.levelBadgeNumberEl = document.getElementById('levelBadgeNumber');
    this.dolphinsSavedBadgeEl = document.getElementById('dolphinsSavedBadge');
    this.dolphinsSavedNumberEl = document.getElementById('dolphinsSavedNumber');
    this.pearlsNumberEl = document.getElementById('pearlsNumber');
    this.startWithPodCheckbox = document.getElementById('startWithPodCheckbox') as HTMLInputElement | null;
    this.startWith8PodCheckbox = document.getElementById('startWith8PodCheckbox') as HTMLInputElement | null;

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

    // Screen shake runs on Pixi's render ticker (smooth 60fps), decoupled from the ~80ms sim loop.
    this.app.ticker.add(() => {
      if (this.shakeTime > 0) {
        // Clamp so a resume from a backgrounded tab can't blow the whole shake in one frame.
        this.shakeTime -= Math.min(this.app.ticker.deltaMS, 50) / 1000;
        const m = Math.max(0, this.shakeTime / (SHAKE_DURATION_MS / 1000)) * this.shakeMagnitude;
        this.stage.position.set((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
      } else if (this.stage.x !== 0 || this.stage.y !== 0) {
        this.stage.position.set(0, 0);
      }
    });
    window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
    });

    this.particles = new ParticleSystem(this.fxContainer);

    await this.createBackground();
    await this.loadSharkTextures();
    this.createEnvironment();
    this.initModel(this.getSelectedLevelConfig());

    // Warm the Play Games sign-in state (no-op off Android) so the leaderboard
    // overlay can show a global rank without a round-trip delay.
    void playGames.ensureSignedIn();
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
      { kind: 'greatWhite', move: `${ASSET_BASE}sharks/spr_shark_move_strip9.png`, attack: `${ASSET_BASE}sharks/spr_shark_attack_strip9.png` },
      { kind: 'hammerhead', move: `${ASSET_BASE}sharks/spr_hammerhead_shark_move_strip9.png`, attack: `${ASSET_BASE}sharks/spr_hammerhead_shark_attack_strip9.png` },
      { kind: 'tiger', move: `${ASSET_BASE}sharks/spr_tiger_shark_move_strip9.png`, attack: `${ASSET_BASE}sharks/spr_tiger_shark_attack_strip9.png` },
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

  /** 0 right after sprinting, ramping up to 1 once the cooldown has fully recharged - lets the UI
   * show a recharge indicator on the Sprint button instead of it just silently becoming usable. */
  /** Sprint duration in ms: the base plus the Store's Boost Duration upgrade. */
  private sprintDurationMs(): number {
    return SPRINT_DURATION + this.sprintDurationBonus;
  }

  /** Freeze-frame + light screen shake for a big kill. No-op under prefers-reduced-motion. */
  private triggerBigKillFeedback(): void {
    if (this.reducedMotion) return;
    this.hitStopUntil = Date.now() + HIT_STOP_MS;
    this.shakeMagnitude = SHAKE_MAGNITUDE;
    this.shakeTime = SHAKE_DURATION_MS / 1000;
  }

  /** Plays the kill blip, bumping the combo (and its pitch) unless too long since the last kill. */
  private registerKillSound(): void {
    if (this.gameTime - this.lastKillTime > COMBO_RESET_SECONDS) this.killCombo = 0;
    this.killCombo++;
    this.lastKillTime = this.gameTime;
    sfx.playSharkKill(this.killCombo - 1);
  }

  private resetKillCombo(): void {
    this.killCombo = 0;
    this.lastKillTime = 0;
  }

  getSprintCooldownFraction(): number {
    const now = Date.now();
    if (now >= this.sprintCooldownEnd) return 1;
    const total = this.sprintDurationMs() + Math.max(3000, SPRINT_COOLDOWN - this.sprintCooldownReduction);
    const startedAt = this.sprintCooldownEnd - total;
    return Math.max(0, Math.min(1, (now - startedAt) / total));
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

  /**
   * The Start / Restart / Retry button. On the first press of a session (also true right
   * after Reset) this begins a fresh run at the picked level; every later press is a genuine
   * retry of the current level with upgrades and run stats kept.
   */
  retry(): void {
    const firstRun = this.sessionStartTime === 0;
    const config = firstRun ? this.getSelectedLevelConfig() : getLevelConfig(this.currentLevel);
    if (!this.initModel(config, !firstRun)) return;
    if (firstRun) this.sessionStartTime = Date.now();
    else this.retries++;
    this.running = true;
    this.startBtn.textContent = firstRun ? 'Restart' : 'Retry';
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
    // Kills up to the checkpoint were already added to the lifetime total last session.
    this.syncedSharkKills = checkpoint.sharksKilled;
    this.totalDolphinsSaved = checkpoint.totalDolphinsSaved;
    this.seenSharkKinds = new Set(checkpoint.seenSharkKinds);
    this.seenLargeSharkKinds = new Set(checkpoint.seenLargeSharkKinds);
    this.seenLargeSharkVariety = checkpoint.seenLargeSharkVariety;

    if (!this.initModel(getLevelConfig(checkpoint.level), true)) return false;
    this.sessionStartTime = Date.now();
    this.runElapsed = checkpoint.elapsedSeconds;
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
      totalDolphinsSaved: this.totalDolphinsSaved,
      elapsedSeconds: this.runElapsed,
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

  /** Snapshot of loop/gate state for the ?diag on-screen readout (see main.ts). */
  debugSnapshot(): Record<string, unknown> {
    return {
      running: this.running,
      paused: this.paused,
      loopTimer: !!this.timer,
      mode: this.mode,
      level: this.currentLevel,
      sharks: this.sharks.length,
      dolphins: this.dolphins.length,
      pod: this.getPodSize(),
      gameTime: Math.round(this.gameTime * 10) / 10,
      activeEvent: this.activeEvent?.type ?? null,
      awaiting: [
        this.awaitingSharkWarning && 'sharkWarning',
        this.awaitingTutorialHint && 'tutorialHint',
        this.awaitingLevelUpChoice && 'levelUp',
        this.awaitingRunSummary && 'runSummary',
        this.awaitingMilestone && 'milestone',
        this.awaitingContinue && 'continue',
        this.awaitingNewWaters && 'newWaters',
      ].filter(Boolean),
      hitStopMs: Math.max(0, this.hitStopUntil - Date.now()),
    };
  }

  formSchool(): void {
    if (!this.readyToSchool || this.huntingMode || this.activeEvent?.type === 'jellyfish') return;
    this.huntingMode = true;
    this.readyToSchool = false;
    this.schoolBtnWrap.classList.add('hidden');
    this.setStatus('HUNTING MODE: ram sharks to destroy them');
    this.updateHuntingVisuals();
    this.onSchoolingChange?.(true);
    this.queueTutorialHint(
      'huntingMode',
      'Hunting Mode!',
      "Swim into a shark to ram and destroy it. The number above each shark is the pod size you need - it turns green once you're strong enough."
    );
  }

  /** Calls in every dolphin saved across the campaign so far to join the pod for the final push on
   * the Matriarch. She isn't defeated on summon - the player has to sprint the Mega Pod into her
   * MATRIARCH_HITS_REQUIRED times (see the hunting-mode kill loop in step()) for the finishing blow. */
  summonMegaPod(): void {
    if (!this.megaPodAvailable || !this.player) return;
    this.megaPodAvailable = false;
    this.megaPodBtnWrap?.classList.add('hidden');
    this.tryUnlock('megaPod');

    const count = this.totalDolphinsSaved;
    for (let i = 0; i < count; i++) {
      this.spawnRecruitedDolphin(this.player._x, this.player._y);
    }
    sfx.playRecruit();
    this.setStatus(count > 0 ? `Mega Pod summoned! +${count} dolphins` : 'Mega Pod summoned!');
    this.showBanner('Mega Pod Summoned!', 'victory', 1800);

    this.megaPodActive = true;
    this.matriarchHitsTaken = 0;
    this.matriarchHitCooldownUntil = 0;
  }

  /** Briefly flashes the Matriarch's sprite to acknowledge a Mega Pod ram that didn't finish her off. */
  private flashMatriarchHit(shark: Shark): void {
    const sprite = this.sharkSprites.get(shark);
    const fish = sprite?.getChildByName('fish') as unknown as { tint: number } | undefined;
    if (!fish) return;
    [0xff4444, 0xffffff, 0xff4444, 0xffffff].forEach((tint, i) => {
      setTimeout(() => {
        if (this.sharkSprites.get(shark) === sprite) fish.tint = tint;
      }, i * 90);
    });
  }

  /** The Mega Pod's finishing blow, once the Matriarch has taken MATRIARCH_HITS_REQUIRED sprinting rams. */
  private finishMatriarchWithMegaPod(): void {
    if (!this.matriarch) return;
    this.megaPodActive = false;
    const scale = CANVAS_SIZE / SIZE;
    this.particles.emit('hit', this.matriarch._x * scale + scale / 2, this.matriarch._y * scale + scale / 2, 24, {
      speed: 4,
      life: 0.8,
    });
    this.sharksKilled++;
    this.playSharkDeathAnimation(this.matriarch);
    this.tryUnlock('matriarchSlayer');
    this.setStatus('The Matriarch is defeated!');
    this.showBanner('Matriarch Defeated!', 'victory', 1800);
    this.levelComplete();
  }

  private pauseGame(): void {
    if (!this.running || this.paused || this.awaitingLevelUpChoice || this.awaitingSharkWarning || this.awaitingRunSummary || this.awaitingTutorialHint || this.awaitingMilestone || this.awaitingContinue) return;
    this.paused = true;
    if (this.timer) clearTimeout(this.timer);
    this.flushLifetimeStats();
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
    await this.loadBackground(`${ASSET_BASE}OpenOceanBGImage.webp`);
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

  /** Adds an already-recruited dolphin directly to the pod (bonus/summoned dolphins, not found-and-swum-to). */
  private spawnRecruitedDolphin(x: number, y: number): void {
    const dolphin = new Dolphin(this.dolphins.length, y, x);
    dolphin.recruited = true;
    this.totalRecruited++;
    this.dolphins.push(dolphin);
    this.addDolphinSprite(dolphin);
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
      this.sprintDurationBonus = 0;
      this.seenSharkKinds = new Set<SharkKind>();
      this.seenLargeSharkKinds = new Set<SharkKind>();
      this.seenLargeSharkVariety = false;
      this.retries = 0;
      this.totalRecruited = 0;
      this.totalLost = 0;
      this.sharksKilled = 0;
      this.sessionStartTime = 0;
      this.runElapsed = 0;
      this.totalDolphinsSaved = 0;
      this.lastMusicLevel = 0;
      this.syncedSharkKills = 0;
      this.lastBoostNudgeTime = 0;
      this.pearlsThisRun = 0;
      this.achievementsThisRun = [];
      this.unsyncedPlaySeconds = 0;
      this.lifetimeFlushAt = 20;
      this.playDayRecorded = false;
      this.leaderboardOverlayEl?.classList.add('hidden');

      // Endless only: the Store's permanent upgrades seed this run's starting stats;
      // in-run Mega Shrimp picks then add on top (chooseUpgrade). Campaign is untouched.
      if (this.mode === 'endless') {
        const b = endlessStartBonuses();
        this.vitalityLives = b.vitalityLives;
        this.speedBonusPct = b.speedBonusPct;
        this.charismaBonusDolphins = b.charismaBonusDolphins;
        this.sprintCooldownReduction = b.sprintCooldownReduction;
        this.sprintDurationBonus = b.sprintDurationBonus;
      }
    }
    this.wasOnLastLifeThisLevel = false;

    for (let i = 0; i < this.charismaBonusDolphins; i++) {
      this.spawnRecruitedDolphin(px, py);
    }

    // Testing aid: level 10 (the Matriarch fight) is otherwise a long grind to reach in a fresh
    // run just to test it, so checkboxes on that level's Level Select entry let you jump in
    // already at a useful pod size - 4 (the Hunting Mode threshold) or 8 (large tiger sharks'
    // pod requirement) - instead of building up to it manually.
    if (config.level === 10 && this.mode === 'campaign') {
      const startingPodSize = this.startWith8PodCheckbox?.checked ? 8 : this.startWithPodCheckbox?.checked ? 4 : 0;
      for (let i = 0; i < startingPodSize - 1; i++) {
        this.spawnRecruitedDolphin(px, py);
      }
    }

    this.currentLevel = config.level;
    this.sharks = [];
    this.gameTime = 0;
    this.lostThisLevel = 0;
    this.spawnSharksForLevel(config);
    this.draw();

    this.nextDolphinSpawnTime = this.dolphinSpawnInterval;
    this.lastFrameTime = 0;
    this.magicShrimp = null;
    this.shrimpSpawned = false;
    this.podHeading = 0;
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
    if (this.levelCompleteTimer) {
      clearTimeout(this.levelCompleteTimer);
      this.levelCompleteTimer = null;
    }
    this.levelCompleted = false;
    this.autoFormedThisLevel = false;
    this.sprinting = false;
    this.sprintEndTime = 0;
    this.sprintCooldownEnd = 0;
    this.resetKillCombo();
    this.hitStopUntil = 0;
    this.shakeTime = 0;
    this.stage?.position.set(0, 0);
    this.awaitingNewWaters = false;
    this.newWatersPromptEl.classList.remove('visible');
    this.awaitingLevelUpChoice = false;
    this.levelUpOverlayEl.classList.add('hidden');
    this.awaitingSharkWarning = false;
    this.sharkWarningOverlayEl.classList.add('hidden');
    this.awaitingRunSummary = false;
    this.runSummaryOverlayEl?.classList.add('hidden');
    this.awaitingMilestone = false;
    this.pendingMilestone = false;
    this.milestoneOverlayEl?.classList.add('hidden');
    this.awaitingContinue = false;
    this.continueUsedThisRun = false;
    this.continueOverlayEl?.classList.add('hidden');
    this.gameOverOverlayEl?.classList.add('hidden');
    this.startBtn.classList.remove('hidden');
    this.paused = false;
    this.pauseOverlayEl.classList.add('hidden');
    this.loadBackground(getLevelBackground(config.level)).catch((err) => console.warn('Background load failed:', err));
    this.updateStats();
    this.draw();
    this.checkForNewSharks(config);
    this.announceLevel();
    this.applyLevelMusic();
    this.updateDolphinsSavedBadge();
    this.updatePearlsBadge();
    return true;
  }

  private announceLevel(duration = 2200): void {
    this.updateLevelBadge();
    this.showBanner(`Level ${this.currentLevel}`, 'victory', duration);
  }

  private updateLevelBadge(): void {
    if (this.levelBadgeNumberEl) this.levelBadgeNumberEl.textContent = String(this.currentLevel);
  }

  /** Shown only in Campaign mode, where Dolphins Saved is actually tracked (see saveDolphinsAndDepart). */
  private updateDolphinsSavedBadge(): void {
    this.dolphinsSavedBadgeEl?.classList.toggle('hidden', this.mode !== 'campaign');
    if (this.dolphinsSavedNumberEl) this.dolphinsSavedNumberEl.textContent = String(this.totalDolphinsSaved);
  }

  /** The persisted Pearl balance, shown in both modes (see src/pearls.ts). */
  private updatePearlsBadge(): void {
    if (this.pearlsNumberEl) this.pearlsNumberEl.textContent = String(getPearls());
  }

  /** Banks `n` Pearls: adds to the persisted balance and the run total, and refreshes the HUD. */
  private awardRunPearls(n: number): void {
    if (n <= 0) return;
    this.pearlsThisRun += n;
    awardPearls(n);
    this.updatePearlsBadge();
  }

  /**
   * Picks the background music track for the level just entered (a no-op on a same-level retry,
   * since currentLevel won't have changed). A boss level gets a fresh random boss track; the level
   * right after a boss level (or level 1 of a fresh run) gets a fresh random ambient track; any other
   * level leaves whatever's already playing alone, so the ambient track loops across a whole block.
   */
  private applyLevelMusic(): void {
    if (this.currentLevel === this.lastMusicLevel) return;
    this.lastMusicLevel = this.currentLevel;

    const config = getLevelConfig(this.currentLevel);
    if (config.matriarch) {
      this.onMusicTrackChange?.(pickRandomTrack(BOSS_TRACKS));
      return;
    }

    const previousWasBoss = this.currentLevel > 1 && getLevelConfig(this.currentLevel - 1).matriarch;
    if (this.currentLevel === 1 || previousWasBoss) {
      this.onMusicTrackChange?.(pickRandomTrack(AMBIENT_TRACKS));
    }
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

    const fish = createDolphinSprite(skinById(equippedSkinId()).palette);
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

  /** Detaches a dolphin's sprite from normal tracking and animates it swimming off-screen before destroying it. */
  private departDolphinSprite(dolphin: Dolphin): void {
    const sprite = this.dolphinSprites.get(dolphin);
    if (!sprite) return;
    this.dolphinSprites.delete(dolphin);

    const startX = sprite.x;
    const start = performance.now();
    const DURATION = 650;
    const DRIFT = 220;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      sprite.x = startX + t * DRIFT;
      sprite.alpha = 1 - t;
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.entityContainer.removeChild(sprite);
        sprite.destroy();
      }
    };
    requestAnimationFrame(animate);
  }

  private removeSharkSprite(shark: Shark): void {
    const sprite = this.sharkSprites.get(shark);
    if (sprite) {
      this.entityContainer.removeChild(sprite);
      sprite.destroy();
      this.sharkSprites.delete(shark);
    }
  }

  /** A more dramatic death for large sharks and the Matriarch - rapid tint flashing plus a
   * scale-and-fade burst, instead of the instant removal small sharks get. */
  private playSharkDeathAnimation(shark: Shark): void {
    const sprite = this.sharkSprites.get(shark);
    if (!sprite) return;
    this.sharkSprites.delete(shark);

    const fish = sprite.getChildByName('fish') as unknown as { tint: number } | null;
    const baseScaleX = sprite.scale.x;
    const baseScaleY = sprite.scale.y;
    const start = performance.now();
    const DURATION = 700;
    const FLASH_INTERVAL = 70;
    let lastFlash = 0;
    let flashOn = false;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / DURATION);

      if (fish && elapsed - lastFlash >= FLASH_INTERVAL) {
        lastFlash = elapsed;
        flashOn = !flashOn;
        fish.tint = flashOn ? 0xffffff : 0xff2222;
      }

      const burst = 1 + Math.sin(t * Math.PI) * 0.4;
      sprite.scale.set(baseScaleX * burst, baseScaleY * burst);
      sprite.alpha = 1 - t;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.entityContainer.removeChild(sprite);
        sprite.destroy();
      }
    };
    requestAnimationFrame(animate);
  }

  /** Endless mode: instead of being destroyed, the Matriarch flashes damaged and swims off - she'll be back. */
  private fleeMatriarch(shark: Shark): void {
    // The Matriarch first appears at level 10, then every 10 levels; seeing her off at 20+
    // means the player has now survived a second encounter.
    if (this.currentLevel >= 20) this.tryUnlock('matriarchRematch');
    const sprite = this.sharkSprites.get(shark);
    if (sprite) {
      this.sharkSprites.delete(shark);
      const fish = sprite.getChildByName('fish');
      if (fish) (fish as unknown as { tint: number }).tint = 0xff4444;

      const startX = sprite.x;
      const start = performance.now();
      const DURATION = 900;
      const DRIFT = 260;
      const animate = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        sprite.x = startX + t * DRIFT;
        sprite.alpha = 1 - t;
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          this.entityContainer.removeChild(sprite);
          sprite.destroy();
        }
      };
      requestAnimationFrame(animate);
    }
    this.setStatus('The Matriarch flees, wounded...');
    this.showBanner('Matriarch Flees!', 'storm', 2600);
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

  /**
   * Swims a pod member toward its formation slot the way the player moves: a continuous
   * heading rather than 8-direction snapping, eased into a turn, and slowed on approach.
   *
   * The old version stepped `Math.sign(delta) * speed` on each axis, so a follower always
   * moved a full step in one of 8 directions - it overshot its slot, reversed on the next
   * tick, and flip-flopped its facing, which read as shaky and clunky next to the player's
   * analog movement.
   */
  private moveTowards(dolphin: Dolphin, tx: number, ty: number, speed: number): void {
    const dx = directionDelta(tx, dolphin._x);
    const dy = ty - dolphin._y;
    const dist = Math.hypot(dx, dy);

    // Velocity the slot is asking for: full speed far out, easing to zero on arrival. There is
    // deliberately no "close enough, stop" threshold - against a slot that is itself moving, a
    // cutoff makes a follower flick between moving and frozen every few ticks, which is exactly
    // what read as shaking.
    // CATCH_UP lets a follower briefly outpace the player to close a gap. Capped at the
    // player's own speed it could never recover the ground lost while easing through a turn,
    // so the pod slowly strung out behind instead of holding formation.
    const SLOW_RADIUS = 3;
    const CATCH_UP = 1.5;
    // Inside PARK_RADIUS ask for nothing, so a follower stops micro-correcting on the spot.
    // Safe now that the formation only turns with the player: a moving slot outruns this in a
    // single tick, so it can never park mid-chase (which is what the old 0.4 radius did).
    const PARK_RADIUS = 0.15;
    const wanted = dist < PARK_RADIUS ? 0 : Math.min(speed * CATCH_UP, (dist / SLOW_RADIUS) * speed);
    const desiredVX = dist > 0.001 ? (dx / dist) * wanted : 0;
    const desiredVY = dist > 0.001 ? (dy / dist) * wanted : 0;

    // Ease the actual velocity toward it rather than adopting it outright: turns arc, and a
    // follower coasts to a halt in its slot instead of stopping dead.
    const SMOOTH = 0.22;
    dolphin.velX += (desiredVX - dolphin.velX) * SMOOTH;
    dolphin.velY += (desiredVY - dolphin.velY) * SMOOTH;

    // Below a twentieth of a world unit per tick there is nothing left to show; park it so a
    // settled pod is completely still.
    if (Math.hypot(dolphin.velX, dolphin.velY) < 0.05) {
      dolphin.velX = 0;
      dolphin.velY = 0;
      return;
    }
    dolphin._x = wrapX(dolphin._x + dolphin.velX);
    dolphin._y = clampEntityY(dolphin._y + dolphin.velY, 2);
  }

  private moveFollowers(): void {
    if (!this.player) return;
    const boosted = Date.now() < this.player.speedBoostUntil;
    const followerSpeed = (boosted ? 4 : 2) * (1 + this.speedBonusPct) * (this.sprinting ? SPRINT_SPEED : 1);
    const followers = this.dolphins.filter((d) => d.recruited && !d.isPlayer);
    // A single fixed-radius ring packs dolphins on top of each other once the pod gets big (the
    // Mega Pod especially). A golden-angle spiral instead spreads them across a disk whose area
    // grows with the pod, so density - and spacing - stays roughly constant at any pod size.
    const GOLDEN_ANGLE = 2.39996;
    const MAX_RADIUS = 35;

    // The formation is oriented by the player's heading, not by a clock. It used to spin with
    // `gameTime * 0.5`, so every slot orbited the player forever - the pod could never settle
    // and kept shuffling even while the player stood still. Now it holds station and only
    // sweeps round as the player actually turns.
    const pdx = directionDelta(this.player._x, this.player.lastX);
    const pdy = this.player._y - this.player.lastY;
    if (Math.hypot(pdx, pdy) > 0.05) {
      let diff = Math.atan2(pdy, pdx) - this.podHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.podHeading += diff * 0.15;
    }

    followers.forEach((dolphin, idx) => {
      const angle = idx * GOLDEN_ANGLE + this.podHeading;
      const radius = Math.min(MAX_RADIUS, 4 + 2 * Math.sqrt(idx));
      // Not rounded: quantising the slot to whole units made it hop between cells, which the
      // follower then chased - another source of the twitchy look.
      const tx = wrapX(this.player!._x + Math.cos(angle) * radius);
      const ty = clampEntityY(this.player!._y + Math.sin(angle) * radius, 2);
      this.moveTowards(dolphin, tx, ty, followerSpeed);
    });
  }

  private gameOver(): void {
    this.running = false;
    this.totalLost++;
    if (this.timer) clearTimeout(this.timer);
    this.flushLifetimeStats();
    this.setStatus('Eaten by a shark');
    this.showBanner('Game Over', 'gameover');

    // Android only: one Continue per Endless run - watch a rewarded ad or buy it (src/ads.ts, src/iap.ts).
    if (this.mode === 'endless' && isAndroid && !this.continueUsedThisRun && (ads.available || iap.available)) {
      this.showContinueOffer();
      return;
    }
    this.finishGameOver();
  }

  /** The end of a run once Continue is declined / unavailable / already used. */
  private finishGameOver(): void {
    if (isAndroid) {
      // No free retry on Android - the run is over (or you took the Continue offer).
      this.startBtn.classList.add('hidden');
    } else {
      this.startBtn.textContent = 'Retry';
    }

    if (this.mode === 'endless') {
      this.endlessDeaths++;
      const timeSurvived = this.runElapsed;
      this.pendingScore = {
        board: 'endless',
        score: {
          levelReached: this.currentLevel,
          timeSurvived,
          recruited: this.totalRecruited,
          sharksKilled: this.sharksKilled,
        },
      };
      this.showRunSummary('endless');
    } else if (isAndroid) {
      // Campaign keeps its checkpoint (Continue Campaign from the title); with no Retry
      // button the player still needs an explicit way back to the menu.
      this.gameOverOverlayEl?.classList.remove('hidden');
    }
  }

  /** Android Endless Game Over: offer a one-time Continue (rewarded ad or IAP). */
  private showContinueOffer(): void {
    if (!this.continueOverlayEl) {
      this.finishGameOver();
      return;
    }
    this.awaitingContinue = true;
    if (this.continueDepthEl) this.continueDepthEl.textContent = `Level ${this.currentLevel}`;

    if (this.continueAdBtnEl) {
      this.continueAdBtnEl.classList.toggle('hidden', !ads.available);
      this.continueAdBtnEl.disabled = !ads.rewardedReady;
      if (ads.available && !ads.rewardedReady) {
        void ads.preloadRewarded().then((ready) => {
          if (this.continueAdBtnEl && this.awaitingContinue) this.continueAdBtnEl.disabled = !ready;
        });
      }
    }
    if (this.continuePayBtnEl) {
      this.continuePayBtnEl.classList.add('hidden');
      void iap.continuePrice().then((price) => {
        if (this.continuePayBtnEl && this.awaitingContinue && price) {
          this.continuePayBtnEl.textContent = `Continue – ${price}`;
          this.continuePayBtnEl.classList.remove('hidden');
        }
      });
    }

    this.continueOverlayEl.classList.remove('hidden');
  }

  async continueViaAd(): Promise<void> {
    if (this.continueAdBtnEl) this.continueAdBtnEl.disabled = true;
    const rewarded = await ads.showRewarded();
    if (rewarded) this.revive();
    else if (this.continueAdBtnEl) this.continueAdBtnEl.disabled = !ads.rewardedReady;
  }

  async continueViaPurchase(): Promise<void> {
    if (this.continuePayBtnEl) this.continuePayBtnEl.disabled = true;
    const purchased = await iap.buyContinue();
    if (purchased) this.revive();
    else if (this.continuePayBtnEl) this.continuePayBtnEl.disabled = false;
  }

  /** "No Thanks" on the Continue offer - proceed to the normal run-summary. */
  declineContinue(): void {
    if (!this.awaitingContinue) return;
    this.awaitingContinue = false;
    this.continueOverlayEl?.classList.add('hidden');
    this.finishGameOver();
  }

  /** Puts the player back in the water mid-run with a fresh pod. Score / sharks / level all carry over. */
  private revive(): void {
    if (!this.player) {
      this.declineContinue();
      return;
    }
    this.continueUsedThisRun = true;
    this.awaitingContinue = false;
    this.continueOverlayEl?.classList.add('hidden');

    this.player.invulnerableUntil = Date.now() + 4000;
    this.player._x = Math.floor(SIZE / 2);
    this.player._y = Math.floor(SIZE / 2);
    for (let i = 0; i < 3; i++) this.spawnRecruitedDolphin(this.player._x, this.player._y);

    this.playerHitCooldownUntil = Date.now() + 4000;
    this.resetKillCombo();
    this.running = true;
    this.setStatus('Back in the water!');
    this.showBanner('Continue!', 'victory', 1500);
    this.lastFrameTime = 0;
    this.step();
  }

  private levelComplete(): void {
    this.levelCompleted = true;
    this.resetKillCombo();
    if (this.lostThisLevel === 0) this.tryUnlock('flawlessLevel');
    if (this.mode === 'campaign' && this.currentLevel === 5) this.tryUnlock('halfwayThere');
    if (this.wasOnLastLifeThisLevel) this.tryUnlock('comeback');
    this.flushLifetimeStats();
    const pearls = pearlsForLevel(this.currentLevel, this.lostThisLevel === 0);
    this.awardRunPearls(pearls);
    if (this.mode === 'endless' && this.currentLevel === 50) this.pendingMilestone = true;
    this.saveDolphinsAndDepart();
    this.setStatus('All sharks destroyed!');

    // The campaign finale gets a longer pause and skips the generic banner - it's reached right
    // after the Matriarch's own "Matriarch Defeated!" banner, which this would otherwise stomp.
    const isCampaignFinale = this.mode === 'campaign' && this.currentLevel === LEVELS.length;
    if (!isCampaignFinale) {
      this.showBanner(`Level Complete!  +${pearls} Pearls`, 'victory', 1800);
    }

    if (this.levelCompleteTimer) clearTimeout(this.levelCompleteTimer);
    this.levelCompleteTimer = setTimeout(() => {
      this.levelCompleteTimer = null;
      if (isCampaignFinale) {
        this.recordCampaignClear();
      } else if (this.pendingMilestone) {
        this.pendingMilestone = false;
        this.showMilestone();
      } else {
        this.showLevelUpChoice();
      }
    }, isCampaignFinale ? 5000 : 2000);
  }

  /** Fires the instant the level is cleared, not when the next one starts: in Campaign mode, the
   * outgoing pod's size is banked as Dolphins Saved and the companions swim off-screen right away.
   * Endless mode just clears them instantly (no saved-dolphins tracking there - see Mega Pod docs). */
  private saveDolphinsAndDepart(): void {
    if (!this.player) return;
    if (this.mode === 'campaign') {
      const pod = this.getPodSize();
      this.totalDolphinsSaved += pod;
      this.updateDolphinsSavedBadge();
      const lifetime = bumpLifetime('dolphinsSaved', pod);
      if (lifetime >= 1000) this.tryUnlock('guardianOfThePod');
      else if (lifetime >= 100) this.tryUnlock('homebound');
    }
    for (const dolphin of this.dolphins) {
      if (!dolphin.isPlayer) {
        if (this.mode === 'campaign') this.departDolphinSprite(dolphin);
        else this.removeDolphinSprite(dolphin);
      }
    }
    this.dolphins = [this.player];
  }

  /** Campaign-mode classic ending: clearing level 10 stops the run and prompts for the leaderboard. */
  private recordCampaignClear(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    clearRunCheckpoint();
    const timeToSaveOcean = this.runElapsed;
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

    this.flushLifetimeStats();
    if (timeToSaveOcean <= 720) this.tryUnlock('speedrunner');
    if (this.retries === 0) this.tryUnlock('noDoOvers');
    if (this.totalLost === 0) this.tryUnlock('flawlessCampaign');

    this.awardRunPearls(PEARLS_CAMPAIGN_CLEAR + (this.totalLost === 0 ? PEARLS_FLAWLESS_CAMPAIGN_BONUS : 0));

    this.setStatus('You cleared the campaign! The ocean is safe.');
    this.startBtn.textContent = 'Retry';
    this.showBanner('Ocean Saved!', 'victory');
    this.showRunSummary('campaign');
  }

  /** End-of-run card: the dolphin's name, a stat grid, and any achievements from this run. */
  private showRunSummary(board: LeaderboardBoard): void {
    if (!this.runSummaryOverlayEl || !this.pendingScore) return;
    this.awaitingRunSummary = true;

    if (this.runSummaryTitleEl) this.runSummaryTitleEl.textContent = board === 'campaign' ? 'Ocean Saved!' : 'Run Over';
    if (this.runSummaryNameEl) this.runSummaryNameEl.textContent = getDolphinName();

    const rows: [string, string][] =
      this.pendingScore.board === 'campaign'
        ? [
            ['Time', `${this.pendingScore.score.timeToSaveOcean.toFixed(1)}s`],
            ['Retries', String(this.pendingScore.score.retries)],
            ['Dolphins recruited', String(this.pendingScore.score.recruited)],
            ['Dolphins lost', String(this.pendingScore.score.lost)],
            ['Dolphins saved', String(this.totalDolphinsSaved)],
            ['Sharks destroyed', String(this.pendingScore.score.sharksKilled)],
            ['Pearls earned', String(this.pearlsThisRun)],
            ['Pearl balance', String(getPearls())],
          ]
        : [
            ['Depth', `Level ${this.pendingScore.score.levelReached}`],
            ['Survived', `${this.pendingScore.score.timeSurvived.toFixed(1)}s`],
            ['Dolphins recruited', String(this.pendingScore.score.recruited)],
            ['Sharks destroyed', String(this.pendingScore.score.sharksKilled)],
            ['Pearls earned', String(this.pearlsThisRun)],
            ['Pearl balance', String(getPearls())],
          ];
    if (this.runSummaryStatsEl) {
      this.runSummaryStatsEl.innerHTML = rows
        .map(([label, value]) => `<span class="label">${label}</span><span class="value">${value}</span>`)
        .join('');
    }

    if (this.runSummaryAchievementsEl) {
      const unlocked = [...new Set(this.achievementsThisRun)]
        .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
        .filter((a): a is (typeof ACHIEVEMENTS)[number] => !!a);
      this.runSummaryAchievementsEl.innerHTML = unlocked
        .map((a) => `<div class="row"><span>${a.icon}</span><span>${a.name}</span></div>`)
        .join('');
    }

    // The Share button (and its Voyager-skin reward) is a campaign-clear thing only.
    if (this.runSummaryShareBtnEl) {
      this.runSummaryShareBtnEl.classList.toggle('hidden', board !== 'campaign');
      this.runSummaryShareBtnEl.textContent = 'Share';
      this.runSummaryShareBtnEl.disabled = false;
    }
    // On Android there is no Retry button after Game Over - offer an explicit way back to the menu.
    this.runSummaryHomeBtnEl?.classList.toggle('hidden', !isAndroid);

    this.runSummaryOverlayEl.classList.remove('hidden');
  }

  /** Campaign-clear Share button: opens the share sheet and, on success, grants the Voyager skin once. */
  async shareCampaign(): Promise<void> {
    if (this.runSummaryShareBtnEl) this.runSummaryShareBtnEl.disabled = true;
    const shared = await shareMilestone('campaign', getDolphinName());
    if (shared) {
      this.claimShareReward();
      if (this.runSummaryShareBtnEl) this.runSummaryShareBtnEl.textContent = 'Shared ✓';
    } else if (this.runSummaryShareBtnEl) {
      this.runSummaryShareBtnEl.disabled = false;
    }
  }

  /** Endless "Level 50!" milestone overlay - pauses the run until the player shares or taps Keep Diving. */
  private showMilestone(): void {
    this.awaitingMilestone = true;
    if (this.milestoneTextEl) {
      this.milestoneTextEl.textContent = `${getDolphinName()} dove deeper than almost anyone. Share the dive?`;
    }
    this.renderShareReward();
    this.milestoneOverlayEl?.classList.remove('hidden');
  }

  async shareEndless50(): Promise<void> {
    const shared = await shareMilestone('endless50', getDolphinName());
    if (shared) this.claimShareReward();
    this.renderShareReward();
  }

  /** "Keep Diving": closes the milestone overlay and continues to the normal level-up choice. */
  dismissMilestone(): void {
    if (!this.awaitingMilestone) return;
    this.awaitingMilestone = false;
    this.milestoneOverlayEl?.classList.add('hidden');
    this.showLevelUpChoice();
  }

  /** Grants the share-reward skin the first time a milestone is shared. Idempotent. */
  private claimShareReward(): void {
    if (grantSkin(SHARE_REWARD_SKIN)) {
      this.setStatus('Voyager skin unlocked!');
      this.showBanner('Voyager Skin Unlocked!', 'statup', 2600);
    }
  }

  /** Paints the reward preview + caption into #milestoneReward (also used to refresh after a share). */
  private renderShareReward(): void {
    if (!this.milestoneRewardEl) return;
    const owned = ownsSkin(SHARE_REWARD_SKIN);
    const skin = skinById(SHARE_REWARD_SKIN);
    this.milestoneRewardEl.innerHTML = '';

    const preview = document.createElement('canvas');
    preview.className = 'store-skin-preview';
    preview.width = 132;
    preview.height = 88;
    const pctx = preview.getContext('2d');
    if (pctx) {
      const body = makeDolphinBodyCanvas(skin.palette);
      pctx.drawImage(body, 0, 0, body.width, body.height, 0, 0, preview.width, preview.height);
    }
    this.milestoneRewardEl.appendChild(preview);

    const caption = document.createElement('div');
    caption.className = 'milestone-reward-caption';
    caption.textContent = owned ? 'Voyager skin unlocked ✓' : `Share to unlock the ${skin.name} skin`;
    this.milestoneRewardEl.appendChild(caption);
  }

  /** Every 3rd Endless death on Android, show a preloaded interstitial at this natural break. */
  private maybeInterstitial(board: LeaderboardBoard): void {
    if (isAndroid && board === 'endless' && this.endlessDeaths > 0 && this.endlessDeaths % 3 === 0) {
      void ads.maybeShowInterstitial();
    }
  }

  /** Saves the pending score to the local + Play Games leaderboards under the dolphin's name. */
  submitPendingScore(): void {
    if (!this.pendingScore) return;
    const name = getDolphinName();
    if (this.pendingScore.board === 'campaign') {
      saveCampaignScore({ ...this.pendingScore.score, name });
      // Time board is milliseconds, smaller-is-better (see src/playGames.ts).
      void playGames.submit('campaign', this.pendingScore.score.timeToSaveOcean * 1000);
    } else {
      saveEndlessScore({ ...this.pendingScore.score, name });
      void playGames.submit('endless', this.pendingScore.score.levelReached);
    }
    const board = this.pendingScore.board;
    this.pendingScore = null;
    this.awaitingRunSummary = false;
    this.runSummaryOverlayEl?.classList.add('hidden');
    this.maybeInterstitial(board);
    this.showLeaderboard(board);
  }

  /** Dismisses the run-summary card without saving the score. */
  dismissRunSummary(): void {
    const board = this.pendingScore?.board ?? this.currentLeaderboardBoard;
    this.pendingScore = null;
    this.awaitingRunSummary = false;
    this.runSummaryOverlayEl?.classList.add('hidden');
    this.maybeInterstitial(board);
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
        '<tr><th>#</th><th>Name</th><th>Time</th><th>Retries</th><th>Recruited</th><th>Lost</th><th>Sharks</th></tr>';
      const scores = loadCampaignScores();
      if (scores.length === 0) {
        this.renderEmptyLeaderboardRow(7, 'No completed campaign runs yet.');
      } else {
        for (const [i, s] of scores.entries()) {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${i + 1}</td><td class="name-cell" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</td><td>${s.timeToSaveOcean.toFixed(1)}s</td><td>${s.retries}</td><td>${s.recruited}</td><td>${s.lost}</td><td>${s.sharksKilled}</td>`;
          this.leaderboardListEl.appendChild(row);
        }
      }
    } else {
      if (this.leaderboardHeadingEl) this.leaderboardHeadingEl.textContent = 'Endless Leaderboard';
      this.leaderboardHeadEl.innerHTML = '<tr><th>#</th><th>Name</th><th>Level</th><th>Survived</th><th>Recruited</th><th>Sharks</th></tr>';
      const scores = loadEndlessScores();
      if (scores.length === 0) {
        this.renderEmptyLeaderboardRow(6, 'No endless runs yet.');
      } else {
        for (const [i, s] of scores.entries()) {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${i + 1}</td><td class="name-cell" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</td><td>${s.levelReached}</td><td>${s.timeSurvived.toFixed(1)}s</td><td>${s.recruited}</td><td>${s.sharksKilled}</td>`;
          this.leaderboardListEl.appendChild(row);
        }
      }
    }

    void this.updateGlobalLeaderboardSection(board);
    this.leaderboardOverlayEl?.classList.remove('hidden');
  }

  /**
   * Play Games Services global rank for the current board (Android only). Off Android
   * `playGames.available` is false and the whole section stays hidden, leaving the local
   * table as the only leaderboard - which is also all the web/PWA build ever has.
   */
  private async updateGlobalLeaderboardSection(board: LeaderboardBoard): Promise<void> {
    const section = this.leaderboardGlobalEl;
    if (!section) return;
    if (!playGames.available) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    if (this.leaderboardGlobalBtn) this.leaderboardGlobalBtn.hidden = true;
    if (this.leaderboardSignInBtn) this.leaderboardSignInBtn.hidden = true;
    if (this.leaderboardGlobalRankEl) this.leaderboardGlobalRankEl.textContent = 'Checking Play Games…';

    const signedIn = await playGames.ensureSignedIn();
    if (this.currentLeaderboardBoard !== board) return; // a later showLeaderboard() switched boards

    if (!signedIn) {
      if (this.leaderboardGlobalRankEl) {
        this.leaderboardGlobalRankEl.textContent = 'Sign in to Play Games for a global rank.';
      }
      if (this.leaderboardSignInBtn) this.leaderboardSignInBtn.hidden = false;
      return;
    }

    const score = await playGames.playerScore(board);
    if (this.currentLeaderboardBoard !== board) return;
    if (this.leaderboardGlobalBtn) this.leaderboardGlobalBtn.hidden = false;
    if (this.leaderboardGlobalRankEl) {
      this.leaderboardGlobalRankEl.textContent =
        score && score.hasScore
          ? `Global rank ${score.displayRank ?? '#' + score.rank}  ·  ${score.displayScore ?? ''}`.trim()
          : 'No global score yet — finish a run to get on the board.';
    }
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
    if (this.megaShrimpHintEl) {
      const firstTime = !hasSeenHint('megaShrimp');
      this.megaShrimpHintEl.classList.toggle('hidden', !firstTime);
      if (firstTime) markHintSeen('megaShrimp');
    }
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
    this.wasOnLastLifeThisLevel = false;
    if (this.mode === 'endless') {
      if (this.currentLevel >= 15) this.tryUnlock('deepDiver');
      if (this.currentLevel >= 25) this.tryUnlock('abyssal');
      if (this.currentLevel >= 40) this.tryUnlock('intoTheTrench');
    }
    const config = getLevelConfig(this.currentLevel);

    this.setStatus(`Level ${this.currentLevel}: hunt the sharks!`);
    this.announceLevel(2500);
    this.applyLevelMusic();
    this.updateDolphinsSavedBadge();

    if (this.player) {
      // Companions already departed (Campaign) or were removed (Endless) back in levelComplete(),
      // right when the level actually finished - this just clears any stragglers defensively and
      // rebuilds the pod for the level being entered.
      for (const dolphin of this.dolphins) {
        if (!dolphin.isPlayer) this.removeDolphinSprite(dolphin);
      }
      this.dolphins = [this.player];

      for (let i = 0; i < this.charismaBonusDolphins; i++) {
        this.spawnRecruitedDolphin(this.player._x, this.player._y);
      }

      this.player.invulnerableUntil = Date.now() + 5000;
      this.autoFormedThisLevel = false;
    }

    this.levelCompleted = false;
    this.lostThisLevel = 0;
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
        description:
          "These waters hold larger, stronger sharks. A big pod alone won't finish one - you have to Boost (Space, or the ⚡ button) into it while your pod meets its number. Upgrade Boost between levels to dash more often.",
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

  /** Queues a one-time explanatory tooltip the first time a system (Form Pod, Hunting Mode) triggers. */
  private queueTutorialHint(id: HintId, heading: string, text: string): void {
    if (hasSeenHint(id)) return;
    markHintSeen(id);
    this.hintQueue.push({ heading, text });
    this.tryShowNextHint();
  }

  private tryShowNextHint(): void {
    if (this.awaitingTutorialHint || this.hintQueue.length === 0) return;
    if (!this.tutorialHintOverlayEl || !this.tutorialHintTextEl) return;
    const hint = this.hintQueue.shift()!;
    this.awaitingTutorialHint = true;
    if (this.tutorialHintHeadingEl) this.tutorialHintHeadingEl.textContent = hint.heading;
    this.tutorialHintTextEl.textContent = hint.text;
    this.tutorialHintOverlayEl.classList.remove('hidden');
  }

  dismissTutorialHint(): void {
    if (!this.awaitingTutorialHint) return;
    this.awaitingTutorialHint = false;
    this.tutorialHintOverlayEl?.classList.add('hidden');
    this.tryShowNextHint();
    if (!this.awaitingTutorialHint && this.running && !this.paused) {
      this.lastFrameTime = 0;
      this.step();
    }
  }

  /** Unlocks an achievement if it isn't already, queueing its toast if this is a new unlock. Non-blocking. */
  private tryUnlock(id: AchievementId): void {
    const def = unlock(id);
    if (!def) return;
    this.achievementQueue.push({ icon: def.icon, name: def.name });
    this.achievementsThisRun.push(def.id);
    this.processAchievementQueue();
  }

  /** Shows queued achievement toasts one at a time - a single event (a campaign clear especially)
   * can unlock several at once, and the old single-toast code just overwrote them. */
  private processAchievementQueue(): void {
    if (this.achievementToastTimeout || this.achievementQueue.length === 0) return;
    if (!this.achievementToastEl || !this.achievementToastNameEl) {
      this.achievementQueue = [];
      return;
    }
    const next = this.achievementQueue.shift()!;
    sfx.playAchievement();
    if (this.achievementToastIconEl) this.achievementToastIconEl.textContent = next.icon;
    this.achievementToastNameEl.textContent = next.name;
    this.achievementToastEl.classList.add('visible');
    this.achievementToastTimeout = setTimeout(() => {
      this.achievementToastEl?.classList.remove('visible');
      this.achievementToastTimeout = setTimeout(() => {
        this.achievementToastTimeout = null;
        this.processAchievementQueue();
      }, 350);
    }, 2600);
  }

  /** Pushes this run's new shark kills and elapsed play time into the persistent lifetime
   * totals and unlocks the cumulative achievements. Called at run-end points and periodically
   * from step(); safe to call repeatedly (it only ever adds the un-synced delta). */
  private flushLifetimeStats(): void {
    const newKills = this.sharksKilled - this.syncedSharkKills;
    if (newKills > 0) {
      this.syncedSharkKills = this.sharksKilled;
      const total = bumpLifetime('sharksKilled', newKills);
      if (total >= 1000) this.tryUnlock('sharkaggeddon');
      else if (total >= 100) this.tryUnlock('sharkCentury');
    }
    const wholeSeconds = Math.floor(this.unsyncedPlaySeconds);
    if (wholeSeconds > 0) {
      this.unsyncedPlaySeconds -= wholeSeconds;
      const total = bumpLifetime('playSeconds', wholeSeconds);
      if (total >= 36000) this.tryUnlock('theLongGame');
    }
  }

  showAchievements(): void {
    if (!this.achievementsListEl) return;
    const unlocked = getUnlockedMap();
    this.achievementsListEl.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const date = unlocked[a.id];
      const row = document.createElement('div');
      row.className = `achievement-row${date ? ' unlocked' : ''}`;
      row.innerHTML = `
        <span class="achievement-icon">${date ? a.icon : '🔒'}</span>
        <div class="achievement-copy">
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.description}</div>
        </div>
        <span class="achievement-status">${date ? new Date(date).toLocaleDateString() : 'Locked'}</span>
      `;
      this.achievementsListEl.appendChild(row);
    }
    this.achievementsOverlayEl?.classList.remove('hidden');
  }

  hideAchievements(): void {
    this.achievementsOverlayEl?.classList.add('hidden');
  }

  private getPodSize(): number {
    return this.dolphins.filter((d) => d.isPlayer || d.recruited).length;
  }

  /** Radius at which a shark can bite the pod. Deliberately tight - see sharkRamRadius. */
  private sharkHitRadius(shark: Shark): number {
    if (shark.matriarch) return 10;
    if (shark.kind === 'greatWhite' && shark.large) return 6;
    return 4;
  }

  /**
   * Radius at which the pod can destroy a shark. Scaled to the drawn sprite
   * (SHARK_KIND_SCALE x sizeMultiplier - see the draw loop), because a large tiger is 2.5x
   * the size of a small one but used to share its 4-unit hitbox: you could sprint visibly
   * *through* one and have the ram not register. Kept separate from (and never smaller than)
   * the bite radius, so generous player hitboxes don't also make sharks more dangerous.
   */
  private sharkRamRadius(shark: Shark): number {
    const bite = this.sharkHitRadius(shark);
    if (shark.matriarch) return bite;
    const drawScale = SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;
    return Math.max(bite, 4 * Math.sqrt(drawScale));
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
    this.matriarchEnraged = false;
    this.matriarchSpawnerTimer = 0;
    this.megaPodAvailable = false;
    this.megaPodActive = false;
    this.matriarchHitsTaken = 0;
    this.matriarchHitCooldownUntil = 0;
    this.megaPodBtnWrap?.classList.add('hidden');
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
    this.lostAtSwarmStart = this.totalLost;
    this.clearJellyfish();
    for (let i = 0; i < JELLYFISH_COUNT; i++) {
      const y = 2 + Math.random() * (SIZE - 4);
      const jelly = new Jellyfish(i, y);
      this.jellyfish.push(jelly);
      const sprite = createJellyfishSprite();
      this.jellyfishContainer.addChild(sprite);
      this.jellyfishSprites.set(jelly, sprite);
    }
    this.setStatus('Jellyfish swarm! Keep the pod moving');
    this.showBanner('Jellyfish Swarm!', 'storm', 2500);
  }

  private endJellyfishSwarm(): void {
    this.clearJellyfish();
    this.activeEvent = null;
    this.setStatus('The swarm has passed');
    if (this.totalLost === this.lostAtSwarmStart) this.tryUnlock('throughTheSwarm');
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
      this.tryUnlock('stormSurvivor');
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

      // Mega Pod only unlocks once every escort - large ones included, not just the small
      // sharks tracked above - is destroyed, so it can't be used as a shortcut past them. No
      // totalDolphinsSaved gate here deliberately: she's only killable via this button in
      // Campaign mode, so it must always appear once escorts are cleared, even with 0 saved
      // (summoning would then just add no dolphins but still land the finishing blow) -
      // otherwise a 0-total run could never defeat her at all.
      if (this.mode === 'campaign' && !this.megaPodAvailable) {
        const escortsRemaining = this.sharks.some((s) => s !== this.matriarch);
        if (!escortsRemaining) {
          this.megaPodAvailable = true;
          this.megaPodBtnWrap?.classList.remove('hidden');
          this.setStatus('The dolphins you saved are ready to be summoned!');
        }
      }

      // Once she's the last shark standing (every escort destroyed), she picks up speed and the
      // same charge/sprint ability large great whites get (see Shark.move in entities.ts).
      if (!this.matriarchEnraged && this.sharks.length === 1 && this.sharks[0] === this.matriarch) {
        this.matriarchEnraged = true;
        this.matriarch.speedMultiplier = GREAT_WHITE_LARGE_SPEED_BONUS;
        this.setStatus('The Matriarch is enraged!');
        this.showBanner('The Matriarch is Enraged!', 'storm', 2200);
      }
    }
  }

  private movePlayer(): void {
    if (!this.player) return;
    const boosted = Date.now() < this.player.speedBoostUntil;
    const maxSpeed = (boosted ? 4 : 2) * (1 + this.speedBonusPct) * (this.sprinting ? SPRINT_SPEED : 1);

    // dx/dy is a unit direction; throttle (0..1) scales the step so a half-pushed
    // joystick / a touch near the centre moves slower than a full deflection.
    let dx = 0;
    let dy = 0;
    let throttle = 1;

    if (this.pointerActive) {
      // pointerDirX/Y is an analog vector from main.ts: ~0 at rest, magnitude ~1 at
      // full deflection (joystick edge, or a touch ~45% of the way to the canvas edge).
      const mag = Math.hypot(this.pointerDirX, this.pointerDirY);
      const DEAD_ZONE = 0.12;
      if (mag > DEAD_ZONE) {
        dx = this.pointerDirX / mag;
        dy = this.pointerDirY / mag;
        // Remap deflection [DEAD_ZONE, 0.9] onto speed [0.35, 1]: a light touch still
        // moves at a usable pace, and full speed is reached just before the edge.
        const t = Math.min(1, (mag - DEAD_ZONE) / (0.9 - DEAD_ZONE));
        throttle = 0.35 + t * 0.65;
      }
    } else {
      if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) dy -= 1;
      if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) dy += 1;
      if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) dx -= 1;
      if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) dx += 1;
      const mag = Math.hypot(dx, dy);
      if (mag > 0) {
        dx /= mag; // normalise so a diagonal isn't ~1.4x faster than a cardinal
        dy /= mag;
      }
    }

    if (dx !== 0 || dy !== 0) {
      const step = maxSpeed * throttle;
      const rawX = this.player._x + dx * step;
      if (this.awaitingNewWaters && dx > 0 && rawX >= SIZE) {
        this.player._x = 2;
        this.player.lastX = 2;
        this.advanceLevel().catch((err) => console.warn('Level transition failed:', err));
      } else {
        this.player._x = wrapX(rawX);
      }
      this.player._y = clampEntityY(this.player._y + dy * step, 2);
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
    if (!this.running || this.awaitingLevelUpChoice || this.awaitingSharkWarning || this.awaitingRunSummary || this.awaitingTutorialHint || this.awaitingMilestone || this.awaitingContinue) return;

    // Hit-stop: keep the loop alive but freeze the simulation for a beat after a big kill.
    if (Date.now() < this.hitStopUntil) {
      this.lastFrameTime = 0;
      this.timer = setTimeout(() => this.step(), 16);
      return;
    }

    const sharkSpeed = parseInt(this.sharkSpeedInput.value, 10) || 1;

    const now = Date.now();
    if (now >= this.sprintEndTime) this.sprinting = false;
    if (this.keys[' '] && now >= this.sprintCooldownEnd) {
      this.sprinting = true;
      this.sprintEndTime = now + this.sprintDurationMs();
      this.sprintCooldownEnd = now + this.sprintDurationMs() + Math.max(3000, SPRINT_COOLDOWN - this.sprintCooldownReduction);
      this.setStatus('Sprint!');
      this.showBanner('Sprint!', 'victory', 800);
    }

    this.movePlayer();
    for (const dolphin of this.dolphins) {
      if (!dolphin.isPlayer && !dolphin.recruited) dolphin.move(this.sharks);
    }
    this.moveFollowers();

    if (this.activeEvent?.type !== 'jellyfish') {
      const podSize = this.getPodSize();
      for (const shark of this.sharks) {
        const unlimitedRange = shark.kind === 'greatWhite' || shark.kind === 'hammerhead';
        // A pod big enough to ram this shark makes it wary (Matriarch excepted - she's a boss),
        // but NOT while the player is boosting: a wary shark holds a buffer of 8 units, which is
        // wider than a large shark's ram radius (6.3 for a tiger), so it parked itself exactly
        // outside kill range from the instant the pod qualified - and a large shark can only be
        // destroyed by a 300ms boost on a 10s cooldown. Boost-ramming one was near impossible.
        // Now the boost makes them commit: they stop backing off the moment you dash.
        const podThreat =
          !shark.matriarch &&
          this.huntingMode &&
          !this.sprinting &&
          podSize >= this.sharkPodRequirement(shark.kind, shark.large);
        shark.move(sharkSpeed, this.player, this.sharks, unlimitedRange, now, podThreat);
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
          this.tryUnlock('firstRecruit');
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
      this.queueTutorialHint(
        'formPod',
        'Pod Ready!',
        `Your pod has reached ${HUNTING_MODE_POD_SIZE} dolphins. Tap Form Pod (or just keep swimming - it forms automatically) to enter Hunting Mode and start destroying sharks.`
      );
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
      let matriarchJustDefeated = false;
      for (const shark of this.sharks) {
        // Any pod member landing the hit counts, not just the dolphin you're steering.
        const ramRadius = this.sharkRamRadius(shark);
        const hitsAnyDolphin = this.dolphins.some((d) => shark.distanceBetween(d) < ramRadius);

        // In Campaign mode the Matriarch can only be hurt while the Mega Pod is active, and only
        // by sprinting into her - each ram flashes her and counts toward MATRIARCH_HITS_REQUIRED,
        // with the final one landing the actual finishing blow (see finishMatriarchWithMegaPod).
        if (shark === this.matriarch && this.mode === 'campaign') {
          if (this.megaPodActive && hitsAnyDolphin && this.sprinting && Date.now() >= this.matriarchHitCooldownUntil) {
            this.matriarchHitCooldownUntil = Date.now() + MATRIARCH_HIT_COOLDOWN_MS;
            this.matriarchHitsTaken++;
            this.particles.emit('hit', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 16, { speed: 3, life: 0.6 });
            if (this.matriarchHitsTaken >= MATRIARCH_HITS_REQUIRED) {
              matriarchJustDefeated = true;
            } else {
              this.flashMatriarchHit(shark);
              this.setStatus(`The Matriarch reels! (${this.matriarchHitsTaken}/${MATRIARCH_HITS_REQUIRED})`);
              this.showBanner('Matriarch Hit!', 'storm', 900);
              survivingSharks.push(shark);
            }
          } else {
            survivingSharks.push(shark);
          }
          continue;
        }

        // Large sharks (Endless Matriarch included) need a big enough pod AND a Sprint at
        // the moment of contact - a plain ram no longer works. Only this.sprinting counts;
        // the Magic-Shrimp speed boost deliberately does not.
        const meetsPod = this.getPodSize() >= this.sharkPodRequirement(shark.kind, shark.large);
        const canDestroy = hitsAnyDolphin && meetsPod && (!shark.large || this.sprinting);
        if (!canDestroy) {
          if (hitsAnyDolphin && meetsPod && shark.large && !this.sprinting && this.gameTime - this.lastBoostNudgeTime > 2) {
            this.lastBoostNudgeTime = this.gameTime;
            this.setStatus('Boost into it!');
          }
          survivingSharks.push(shark);
        } else if (shark === this.matriarch && this.mode === 'endless') {
          this.particles.emit('hit', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 16, { speed: 3, life: 0.6 });
          this.triggerBigKillFeedback();
          this.fleeMatriarch(shark);
        } else {
          this.particles.emit('hit', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 16, { speed: 3, life: 0.6 });
          this.sharksKilled++;
          this.registerKillSound();
          if (shark.large) {
            this.playSharkDeathAnimation(shark);
            this.triggerBigKillFeedback();
          } else {
            this.removeSharkSprite(shark);
          }
          this.tryUnlock('firstHuntingKill');
        }
      }
      this.sharks = survivingSharks;
      if (matriarchJustDefeated) {
        this.finishMatriarchWithMegaPod();
      } else if (this.sharks.length === 0 && !this.levelCompleted) {
        this.levelComplete();
      } else if (this.matriarch && !this.sharks.includes(this.matriarch) && !this.levelCompleted) {
        this.sharksKilled += this.sharks.length;
        if (this.sharks.length > 0) this.triggerBigKillFeedback();
        for (const s of this.sharks) {
          if (s.large) this.playSharkDeathAnimation(s);
          else this.removeSharkSprite(s);
        }
        this.sharks = [];
        if (this.mode !== 'endless') this.tryUnlock('matriarchSlayer');
        this.levelComplete();
      }
    }

    if (this.activeEvent?.type !== 'jellyfish') {
      if (this.player && now >= this.playerHitCooldownUntil && now >= this.player.invulnerableUntil) {
        for (const shark of this.sharks) {
          if (shark.distanceBetween(this.player) < this.sharkHitRadius(shark)) {
            sfx.playBite();
            // The Matriarch takes two pod members per bite; every other shark takes one.
            const bite = shark.matriarch ? 2 : 1;
            const victims: Dolphin[] = [];
            for (let i = this.dolphins.length - 1; i >= 0 && victims.length < bite; i--) {
              const candidate = this.dolphins[i];
              if (!candidate.isPlayer && candidate.recruited && now >= candidate.invulnerableUntil) {
                victims.push(candidate);
              }
            }
            if (victims.length > 0) {
              this.playerHitCooldownUntil = now + 1000;
              this.resetKillCombo();
              for (const v of victims) {
                this.particles.emit('hit', v._x * scale + scale / 2, v._y * scale + scale / 2, 12, { speed: 2, life: 0.6 });
                this.removeDolphinSprite(v);
                this.totalLost++;
                this.lostThisLevel++;
              }
              this.dolphins = this.dolphins.filter((d) => !victims.includes(d));
              const many = victims.length > 1;
              this.setStatus(many ? `${victims.length} dolphins lost!` : 'A dolphin was lost');
              this.showBanner(many ? `${victims.length} Dolphins Lost!` : 'Dolphin Lost!', 'lost', 2000);
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
            // On the last life: pod down to just the player, no extra lives left. Clearing
            // the level from here unlocks Comeback (checked in levelComplete()).
            if (this.getPodSize() === 1 && this.vitalityLives === 0) {
              this.wasOnLastLifeThisLevel = true;
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
          this.lostThisLevel++;
          this.setStatus('A dolphin was stung');
          this.showBanner('Dolphin Stung!', 'lost', 2000);
        }
        break;
      }
    }

    // Clamp the frame delta: a resume from pause already contributes 0 (lastFrameTime is
    // reset to 0), and this caps a backgrounded-tab / GC stall so the world doesn't
    // fast-forward - it just runs slow for a moment instead.
    const dt = this.lastFrameTime === 0 ? 0 : Math.min((now - this.lastFrameTime) / 1000, 0.25);
    this.lastFrameTime = now;
    this.gameTime += dt;
    this.runElapsed += dt;

    // Lifetime stats: count this frame's play time, record the play-day once per run,
    // and flush accumulated totals to storage every ~20s so a force-quit loses little.
    this.unsyncedPlaySeconds += dt;
    if (!this.playDayRecorded) {
      this.playDayRecorded = true;
      if (recordPlayDay() >= 7) this.tryUnlock('devoted');
    }
    if (this.gameTime >= this.lifetimeFlushAt) {
      this.lifetimeFlushAt = this.gameTime + 20;
      this.flushLifetimeStats();
    }

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

      const dx = directionDelta(dolphin._x, dolphin.lastX);
      const dy = dolphin._y - dolphin.lastY;
      const boosted = now < dolphin.speedBoostUntil;
      const fast = boosted || this.sprinting;

      // Whole-body swim: fluke beat, a counter-rotating body arch, a slow vertical bob,
      // a bank into vertical movement, and a forward stretch when moving fast.
      const beat = t * (fast ? 15 : 9) + dolphin.id * 1.7;
      tail.rotation = Math.sin(beat) * (fast ? 0.6 : 0.45);
      const stretch = fast ? 1.14 : 1;

      // Keep facing the last horizontal heading; only flip when genuinely swimming sideways.
      // The threshold is deliberately well above zero: a pod member easing into its formation
      // slot drifts by hundredths of a unit, and at 0.01 every one of those micro-corrections
      // mirrored the sprite. The dolphin flip-flopped on the spot, which read as shaking even
      // though its position was barely changing.
      const FLIP_THRESHOLD = 0.2;
      let dir = Math.sign(fish.scale.x) || 1;
      if (Math.abs(dx) > FLIP_THRESHOLD) dir = dx > 0 ? 1 : -1;
      fish.scale.set(dir * stretch, 1 / stretch);
      fish.rotation = Math.sin(beat - 0.8) * 0.05 + dir * Math.max(-1.4, Math.min(1.4, dy)) * 0.12;
      fish.y = Math.sin(t * 4.5 + dolphin.id) * 0.7;

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
        // The bolt on large sharks flags that a Boost dash is also required, not just the pod.
        reqText.text = shark.large ? `⚡${req}` : String(req);
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
