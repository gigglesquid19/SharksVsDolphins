import { DEPTH_ZONES, DepthZone, getLevelBackground, getLevelConfig, zoneNumber } from './levels';
import { getPearls } from './pearls';
import {
  FREE_START_LEVEL,
  MAX_START_LEVEL,
  buyLevelAccess,
  hasLevelAccess,
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
            <span class="level-cell-state">${unlocked ? '' : '\u{1F512}'}</span>
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
    const kinds = config.sharkKinds
      .map((k) => (k === 'greatWhite' ? 'great whites' : k === 'hammerhead' ? 'hammerheads' : 'tigers'))
      .join(', ');
    return [
      ['Sharks', `${config.normalSharkCount} small, ${config.largeSharkCount} large`],
      ['Kinds', kinds],
      ['Shark speed', `${config.sharkSpeedMultiplier.toFixed(2)}x`],
      ['Pod limit', String(config.maxDolphins)],
    ];
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

    if (previewNoteEl) {
      previewNoteEl.classList.toggle('warn', !ranked);
      previewNoteEl.textContent = ranked
        ? 'A dive from the surface counts on the leaderboard.'
        : 'A dive from this depth never counts on the leaderboard.';
    }

    if (previewActionBtn) {
      if (unlocked) {
        previewActionBtn.textContent = 'Start Level';
        previewActionBtn.disabled = false;
        previewActionBtn.onclick = () => opts.onDive(level);
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
