import { DEPTH_ZONES, DepthZone } from './levels';
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
  const actionBtn = document.getElementById('levelSelectAction') as HTMLButtonElement | null;

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
    render();
  }

  function zoneOf(level: number): DepthZone {
    return DEPTH_ZONES.find((z) => level >= z.firstLevel && level <= z.lastLevel) ?? DEPTH_ZONES[0];
  }

  function renderGrid(): void {
    if (!zonesEl) return;
    zonesEl.innerHTML = DEPTH_ZONES.map((zone) => {
      const cells: string[] = [];
      for (let level = zone.firstLevel; level <= zone.lastLevel; level++) {
        const unlocked = hasLevelAccess(level);
        const classes = ['level-cell'];
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
        render();
      });
    }
  }

  /** The line under the grid, and what the one action button does about it. */
  function renderDetail(): void {
    if (pearlsEl) pearlsEl.textContent = String(getPearls());
    if (!detailEl || !actionBtn) return;

    if (notice) {
      detailEl.textContent = notice;
      actionBtn.textContent = 'Dive from level 1';
      actionBtn.disabled = false;
      actionBtn.onclick = () => opts.onDive(FREE_START_LEVEL);
      return;
    }

    if (selected === null) {
      detailEl.textContent = 'Pick a depth to dive from. Level 1 is always open; the rest are bought once and yours for good.';
      actionBtn.textContent = 'Dive from level 1';
      actionBtn.disabled = false;
      actionBtn.onclick = () => opts.onDive(FREE_START_LEVEL);
      return;
    }

    const zone = zoneOf(selected);
    const unlocked = hasLevelAccess(selected);
    const price = levelAccessPrice(selected);
    const ranked = selected <= FREE_START_LEVEL;

    if (unlocked) {
      detailEl.textContent = ranked
        ? `Level ${selected}, the ${zone.name} Zone at ${zone.depth}. A dive from here counts on the leaderboard.`
        : `Level ${selected}, the ${zone.name} Zone at ${zone.depth}. A dive from here does not count on the leaderboard.`;
      actionBtn.textContent = `Dive from level ${selected}`;
      actionBtn.disabled = false;
      actionBtn.onclick = () => opts.onDive(selected as number);
      return;
    }

    const short = price - getPearls();
    detailEl.textContent =
      short > 0
        ? `Level ${selected}, the ${zone.name} Zone at ${zone.depth}. ${short} more Pearls needed.`
        : `Level ${selected}, the ${zone.name} Zone at ${zone.depth}. Dives from here never count on the leaderboard.`;
    actionBtn.textContent = `Unlock for ${price} Pearls`;
    actionBtn.disabled = short > 0;
    actionBtn.onclick = () => {
      if (selected !== null && buyLevelAccess(selected)) {
        opts.onPearlsChange();
        render();
      }
    };
  }

  function render(): void {
    renderGrid();
    renderDetail();
  }

  document.getElementById('levelSelectCloseBtn')?.addEventListener('click', () => {
    overlay?.classList.add('hidden');
  });
  document.getElementById('levelSelectHeading')?.addEventListener('click', onHeadingTap);

  return {
    open(): void {
      // Deliberately forgotten between visits: reopening should present the whole map again
      // rather than whatever the player was last looking at.
      selected = null;
      notice = '';
      taps = 0;
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
