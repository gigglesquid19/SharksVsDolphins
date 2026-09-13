import {
  DEPTH_ZONES,
  DepthZone,
  LevelConfig,
  getLevelBackground,
  getLevelConfig,
  isSandboxLevel,
  zoneNumber,
} from './levels';
import type { SharkKind } from './sprites';
import { getPearls } from './pearls';
import { secretTapGesture } from './utils';
import { developerModeActive, grantHalfUpgrades, halfUpgradeLevel, setDeveloperMode } from './store';
import {
  FREE_START_LEVEL,
  MAX_START_LEVEL,
  buyLevelAccess,
  hasLevelAccess,
  canBuyDarkDepths,
  depthNeedsEcholocation,
  levelAccessPrice,
  setTestUnlockAll,
  testUnlockAllActive,
} from './levelAccess';

/**
 * The Depthless Campaign's level select: all fifty depths as a grid, grouped by zone, each one
 * locked until it is bought.
 *
 * Every level is shown rather than only the unlocked ones, because the point of the screen is to
 * show a player how far down the mode goes and what it would cost to see it. A grid of five
 * empty rows would say nothing.
 */

export interface LevelSelectHandles {
  open(): void;
  close(): void;
  readonly visible: boolean;
}

export interface LevelSelectOpts {
  /** Begin a Depthless run at this level. Only ever called with a level the player has access to. */
  onDive(level: number): void;
  /** Balance changed, so the title screen's Pearl count needs refreshing. */
  onPearlsChange(): void;
}

/** What each kind is called on the preview card. */
const SHARK_LABELS: Record<SharkKind, string> = {
  greatWhite: 'great whites',
  hammerhead: 'hammerheads',
  tiger: 'tigers',
  frilled: 'frilled sharks',
  cookiecutter: 'cookiecutters',
};

/**
 * What a bench actually holds, counted the same way it is stocked: the spawn deals a sandbox's
 * kinds in turn, so four sharks of two kinds is two of each, and the card can say so.
 */
function benchRoster(config: LevelConfig): string {
  const counts = new Map<SharkKind, number>();
  for (let i = 0; i < config.normalSharkCount; i++) {
    const kind = config.sharkKinds[i % config.sharkKinds.length];
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts].map(([kind, n]) => `${n} ${SHARK_LABELS[kind] ?? kind}`).join(', ');
}

/** How dark a depth is, said in words rather than as a number the player has no scale for. */
function lightLabel(gloom: number | undefined): string {
  if (!gloom) return 'clear water';
  if (gloom < 0.7) return 'dim - echo advised';
  return 'near black - echo needed';
}

export function setupLevelSelect(opts: LevelSelectOpts): LevelSelectHandles {
  const overlay = document.getElementById('levelSelectOverlay') as HTMLDivElement | null;
  const zonesEl = document.getElementById('levelSelectZones');
  const pearlsEl = document.getElementById('levelSelectPearls');
  const detailEl = document.getElementById('levelSelectDetail');
  const gridViewEl = document.getElementById('levelSelectGridView');
  const previewEl = document.getElementById('levelSelectPreview');
  const previewImgEl = document.getElementById('levelPreviewImage') as HTMLImageElement | null;
  const previewBadgeEl = document.getElementById('levelPreviewBadge');
  const previewTitleEl = document.getElementById('levelPreviewTitle');
  const previewZoneEl = document.getElementById('levelPreviewZone');
  const previewStatsEl = document.getElementById('levelPreviewStats');
  const previewNoteEl = document.getElementById('levelPreviewNote');
  const previewActionBtn = document.getElementById('levelPreviewAction') as HTMLButtonElement | null;

  /** The level the player has tapped. Null until they pick one. */
  let selected: number | null = null;
  /** Set by the testing gesture, and cleared by the next thing the player taps. */
  let notice = '';

  /**
   * The testing shortcut: seven taps on the heading opens every depth, seven more puts it back.
   *
   * A tap count rather than a typed code so it works on a phone, which is where early testers
   * will be, and on the heading rather than a level so it cannot be hit by someone browsing the
   * grid. The count resets if the taps are slow, so idle prodding never triggers it.
   */
  const SECRET_TAPS = 7;
  const SECRET_TAP_GAP_MS = 900;
  let taps = 0;
  let lastTapAt = 0;

  function onHeadingTap(): void {
    const now = Date.now();
    taps = now - lastTapAt > SECRET_TAP_GAP_MS ? 1 : taps + 1;
    lastTapAt = now;
    if (taps < SECRET_TAPS) return;
    taps = 0;

    const turningOn = !testUnlockAllActive();
    setTestUnlockAll(turningOn);
    notice = turningOn
      ? 'Testing: every depth is open. Dives from them still do not count on the leaderboard. Seven taps again to switch it off.'
      : 'Testing unlock off. Back to the depths you have actually bought.';
    selected = null;
    showGrid();
  }

  /**
   * The second testing gesture, on the Pearls readout rather than the heading: seven taps hand
   * over half of every upgrade. Same shape as the depth unlock above so there is one thing to
   * remember, and on the Pearls because that is what upgrades are bought with.
   */
  const onPearlsTap = secretTapGesture(SECRET_TAPS, SECRET_TAP_GAP_MS, () => {
    // Toggles, like the depth unlock does, so there is a way back to an ordinary run. Turning it
    // off leaves the upgrades granted: they are indistinguishable from bought ones by then, and
    // taking them away could quietly gut a real build.
    const turningOn = !developerModeActive();
    setDeveloperMode(turningOn);
    if (turningOn) {
      const raised = grantHalfUpgrades();
      const half = halfUpgradeLevel();
      notice =
        `Developer mode on. Every upgrade at level ${half}` +
        (raised > 0 ? ` (${raised} granted, nothing spent)` : ' already') +
        ', and a dolphin every 10s instead of 15. Seven taps again to switch it off.';
    } else {
      notice = 'Developer mode off. Dolphins are back to their usual pace; the upgrades granted are yours to keep.';
    }
    opts.onPearlsChange?.();
    selected = null;
    showGrid();
  });

  function zoneOf(level: number): DepthZone {
    return DEPTH_ZONES.find((z) => level >= z.firstLevel && level <= z.lastLevel) ?? DEPTH_ZONES[0];
  }

  function renderGrid(): void {
    if (!zonesEl) return;
    zonesEl.innerHTML = DEPTH_ZONES.map((zone) => {
      const cells: string[] = [];
      // The zone's own colour, so a glance at the grid reads as five bands rather than fifty
      // identical buttons. The number carries it; the background still carries locked/unlocked.
      const zoneClass = `zone-${zoneNumber(zone)}`;
      for (let level = zone.firstLevel; level <= zone.lastLevel; level++) {
        const unlocked = hasLevelAccess(level);
        const classes = ['level-cell', zoneClass];
        if (unlocked) classes.push('unlocked');
        if (level === selected) classes.push('selected');
        cells.push(
          `<button class="${classes.join(' ')}" data-level="${level}">
            <span class="level-cell-number">${level}</span>
            <span class="level-cell-state">${unlocked ? (isSandboxLevel(level) ? '\u{1F9EA}' : '') : depthNeedsEcholocation(level) && !canBuyDarkDepths() ? '\u{1F30A}' : '\u{1F512}'}</span>
          </button>`,
        );
      }
      return `<div class="level-zone">
          <div class="level-zone-head">
            <span class="level-zone-name">${zone.name} Zone</span>
            <span class="level-zone-depth">${zone.depth}</span>
          </div>
          <div class="level-zone-grid">${cells.join('')}</div>
        </div>`;
    }).join('');

    for (const btn of zonesEl.querySelectorAll<HTMLButtonElement>('.level-cell')) {
      btn.addEventListener('click', () => {
        selected = Number(btn.dataset.level);
        notice = '';
        showPreview();
      });
    }
  }

  /** The hint line under the grid. Only ever a prompt or the testing-unlock notice now. */
  function renderDetail(): void {
    if (pearlsEl) pearlsEl.textContent = String(getPearls());
    if (!detailEl) return;
    detailEl.textContent =
      notice || 'Tap a depth to look at it before you dive. Level 1 is always open; the rest are bought once and yours for good.';
  }

  /** Plain-English shark composition for a depth, from the config the level is actually built from. */
  function previewStats(level: number): [string, string][] {
    const config = getLevelConfig(level);
    const kinds = config.sharkKinds.map((k) => SHARK_LABELS[k] ?? k).join(', ') || 'nothing yet';

    // A sandbox holds a known handful rather than a random draw, so it can say exactly what is down
    // there - "n small, n large" of three kinds would say nothing about a bench.
    if (isSandboxLevel(level)) {
      return [
        ['Sharks', config.normalSharkCount > 0 ? benchRoster(config) : 'empty test water'],
        ['Light', lightLabel(config.gloom)],
        ['Pod limit', String(config.maxDolphins)],
      ];
    }

    const stats: [string, string][] = [
      ['Sharks', `${config.normalSharkCount} small, ${config.largeSharkCount} large`],
      ['Kinds', kinds],
      ['Shark speed', `${config.sharkSpeedMultiplier.toFixed(2)}x`],
      ['Pod limit', String(config.maxDolphins)],
    ];
    if (config.gloom) stats.splice(3, 0, ['Light', lightLabel(config.gloom)]);
    return stats;
  }

  /**
   * The preview: the depth's own artwork and what is swimming in it, with one button underneath.
   *
   * Shown in place of the grid rather than over it, so a player is never two panels deep, and
   * shown for locked levels too - seeing what you would be buying is the point of it.
   */
  function showPreview(): void {
    if (selected === null) return;
    const level = selected;
    const zone = zoneOf(level);
    const unlocked = hasLevelAccess(level);
    const price = levelAccessPrice(level);
    const ranked = level <= FREE_START_LEVEL;
    const short = price - getPearls();

    if (previewImgEl) {
      previewImgEl.src = getLevelBackground(level, 'endless');
      previewImgEl.alt = `Level ${level}, the ${zone.name} Zone`;
    }
    if (previewBadgeEl) previewBadgeEl.textContent = `Level ${level}`;
    if (previewTitleEl) previewTitleEl.textContent = `${zone.name} Zone`;
    if (previewZoneEl) previewZoneEl.textContent = `${zone.depth} \u00b7 level ${level} of ${MAX_START_LEVEL}`;
    if (previewStatsEl) {
      previewStatsEl.innerHTML = previewStats(level)
        .map(
          ([label, value]) =>
            `<div class="level-preview-stat"><span class="label">${label}</span><span class="value">${value}</span></div>`,
        )
        .join('');
    }

    // Shut until Echolocation is on the shelf, which is to say until the campaign is cleared.
    // Checked before affordability, because being short of Pearls is not why this one is closed.
    const needsEcho = !unlocked && depthNeedsEcholocation(level) && !canBuyDarkDepths();

    if (previewNoteEl) {
      previewNoteEl.classList.toggle('warn', needsEcho || !ranked);
      previewNoteEl.textContent = needsEcho
        ? 'The water is dark from here down. Clear the campaign to unlock Echolocation in the Store, and this depth opens with it.'
        : isSandboxLevel(level)
          ? 'Test water for trying new sharks out, dark as the depth really is. Echolocation is lent to you here.'
          : ranked
            ? 'A dive from the surface counts on the leaderboard.'
            : 'A dive from this depth never counts on the leaderboard.';
    }

    if (previewActionBtn) {
      if (unlocked) {
        previewActionBtn.textContent = 'Start Level';
        previewActionBtn.disabled = false;
        previewActionBtn.onclick = () => opts.onDive(level);
      } else if (needsEcho) {
        previewActionBtn.textContent = 'Echolocation needed';
        previewActionBtn.disabled = true;
        previewActionBtn.onclick = null;
      } else if (short > 0) {
        previewActionBtn.textContent = `${short} more Pearls needed`;
        previewActionBtn.disabled = true;
        previewActionBtn.onclick = null;
      } else {
        previewActionBtn.textContent = `Unlock for ${price} Pearls`;
        previewActionBtn.disabled = false;
        previewActionBtn.onclick = () => {
          if (buyLevelAccess(level)) {
            opts.onPearlsChange();
            // Straight back into the preview, now offering Start Level rather than a price.
            showPreview();
          }
        };
      }
    }

    gridViewEl?.classList.add('hidden');
    previewEl?.classList.remove('hidden');
  }

  /** Back out of the preview to the grid, repainted so a purchase shows as unlocked. */
  function showGrid(): void {
    previewEl?.classList.add('hidden');
    gridViewEl?.classList.remove('hidden');
    render();
  }

  function render(): void {
    renderGrid();
    renderDetail();
  }

  document.getElementById('levelSelectCloseBtn')?.addEventListener('click', () => {
    overlay?.classList.add('hidden');
  });
  document.getElementById('levelPreviewBack')?.addEventListener('click', () => {
    selected = null;
    showGrid();
  });
  document.getElementById('levelSelectHeading')?.addEventListener('click', onHeadingTap);
  // The whole Pearls block, icon included - the number on its own is about 12px wide, and a
  // gesture that resets on a miss cannot be built on a target that small.
  (pearlsEl?.closest('.store-pearls') ?? pearlsEl)?.addEventListener('click', onPearlsTap);

  return {
    open(): void {
      // Deliberately forgotten between visits: reopening should present the whole map again
      // rather than whatever the player was last looking at.
      selected = null;
      notice = '';
      taps = 0;
      // Always opens on the grid, never on whatever preview was last looked at.
      previewEl?.classList.add('hidden');
      gridViewEl?.classList.remove('hidden');
      render();
      overlay?.classList.remove('hidden');
    },
    close(): void {
      overlay?.classList.add('hidden');
    },
    get visible(): boolean {
      return !!overlay && !overlay.classList.contains('hidden');
    },
  };
}

export { MAX_START_LEVEL };
