import { makeDolphinBodyCanvas } from './sprites';
import { getDolphinName } from './profile';
import { equippedSkinId, ownsEcholocation, echolocationStats, upgradeLevel, UPGRADES, UpgradeId } from './store';
import { skinById } from './skins';
import {
  CONSUMABLES,
  CONSUMABLE_ORDER,
  MAX_CONSUMABLE_SLOTS,
  getInventory,
  totalConsumablesHeld,
} from './inventory';
import { hasClearedCampaign } from './progress';

/**
 * "Your Dolphin": one screen showing everything the player owns - the dolphin itself in its
 * equipped skin, which abilities it has, how far each Store upgrade is levelled, and what is in
 * the three-slot pack.
 *
 * It only reads. Every purchase still happens in the Store, which is why the panel's one action
 * is a button through to it - a player who finds a locked ability or an empty slot here should
 * be one tap from doing something about it.
 */

/**
 * The Mega Shrimp picks made during a run in progress, and which mode that run is. Null on the
 * title screen, where there is no run to describe.
 */
export interface RunUpgrades {
  mode: 'campaign' | 'endless';
  lives: number;
  speedBonusPct: number;
  podBonus: number;
  boostReductionMs: number;
}

export interface DolphinViewHandles {
  /** Repaints from storage. Call before showing, and after anything that could change ownership. */
  refresh(run?: RunUpgrades | null): void;
  show(run?: RunUpgrades | null): void;
  hide(): void;
  readonly visible: boolean;
}

interface Row {
  icon: string;
  name: string;
  desc: string;
  value: string;
  owned: boolean;
}

function rowHtml({ icon, name, desc, value, owned }: Row): string {
  const state = owned ? 'owned' : 'locked';
  return `<div class="dolphin-row ${state}">
      <div class="dolphin-row-icon" aria-hidden="true">${icon}</div>
      <div class="dolphin-row-body">
        <div class="dolphin-row-name">${name}</div>
        <div class="dolphin-row-desc">${desc}</div>
      </div>
      <div class="dolphin-row-value">${value}</div>
    </div>`;
}

export function setupDolphinView(onOpenStore: () => void): DolphinViewHandles {
  const overlay = document.getElementById('dolphinOverlay') as HTMLDivElement | null;
  const previewEl = document.getElementById('dolphinPreview') as HTMLCanvasElement | null;
  const nameEl = document.getElementById('dolphinPanelName');
  const skinEl = document.getElementById('dolphinPanelSkin');
  const abilitiesEl = document.getElementById('dolphinAbilities');
  const upgradesEl = document.getElementById('dolphinUpgrades');
  const packNoteEl = document.getElementById('dolphinPackNote');
  const slotsEl = document.getElementById('dolphinSlots');
  const runWrapEl = document.getElementById('dolphinRunWrap');
  const runEl = document.getElementById('dolphinRun');
  const runHeadingEl = document.getElementById('dolphinRunHeading');
  const runNoteEl = document.getElementById('dolphinRunNote');
  const upgradesNoteEl = document.getElementById('dolphinUpgradesNote');

  function renderHero(): void {
    const skin = skinById(equippedSkinId());
    if (nameEl) nameEl.textContent = getDolphinName();
    if (skinEl) skinEl.textContent = `${skin.name} skin`;
    if (previewEl) {
      const ctx = previewEl.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, previewEl.width, previewEl.height);
        ctx.imageSmoothingQuality = 'high';
        const body = makeDolphinBodyCanvas(skin.palette);
        ctx.drawImage(body, 0, 0, body.width, body.height, 0, 0, previewEl.width, previewEl.height);
      }
    }
  }

  /**
   * The in-run picks, shown only while a run exists. Zeroes are kept in, so the player can see
   * what they have not taken as well as what they have.
   *
   * Named by mode, because the two are not the same thing and confusing them is easy: in the
   * Campaign these picks are the whole of a dolphin's progress and vanish with the run, while in
   * the Depthless Campaign they sit on top of whatever the Store has already bought.
   */
  function renderRun(run: RunUpgrades | null | undefined): void {
    runWrapEl?.classList.toggle('hidden', !run);
    if (!run || !runEl) return;
    const campaign = run.mode === 'campaign';
    if (runHeadingEl) runHeadingEl.textContent = campaign ? 'This Campaign run' : 'This Depthless run';
    if (runNoteEl) {
      runNoteEl.textContent = campaign
        ? 'Mega Shrimp picks made since this run began. In the Campaign these are all you carry, and they are lost when the run ends.'
        : 'Mega Shrimp picks made since this run began, on top of the Store upgrades below. They are lost when the run ends.';
    }
    const rows: Row[] = [
      { icon: '❤️', name: 'Vitality', desc: 'Extra lives banked this run', value: `+${run.lives}`, owned: run.lives > 0 },
      {
        icon: '💨',
        name: 'Speed',
        desc: 'Swim speed added this run',
        value: `+${Math.round(run.speedBonusPct * 100)}%`,
        owned: run.speedBonusPct > 0,
      },
      { icon: '🐬', name: 'Charisma', desc: 'Extra pod dolphins each level', value: `+${run.podBonus}`, owned: run.podBonus > 0 },
      {
        icon: '⚡',
        name: 'Boost',
        desc: 'Cooldown cut this run',
        value: `-${(run.boostReductionMs / 1000).toFixed(1)}s`,
        owned: run.boostReductionMs > 0,
      },
    ];
    runEl.innerHTML = rows.map(rowHtml).join('');
  }

  function renderAbilities(run: RunUpgrades | null | undefined): void {
    if (!abilitiesEl) return;
    const echo = ownsEcholocation();
    const stats = echolocationStats();
    // Echolocation is bought once but only works in the Depthless Campaign, so during a Campaign
    // run it is owned and unusable - which the panel has to say outright, or a player who paid
    // 200 Pearls for it will go looking for the button.
    const inCampaignRun = run?.mode === 'campaign';

    const rows: Row[] = [
      {
        icon: '⚡',
        name: 'Boost',
        desc: 'Hold Space, or the ⚡ button, for a burst of speed. Needed to ram large sharks.',
        value: 'Always',
        owned: true,
      },
      {
        icon: '\u{1F50A}',
        name: 'Echolocation',
        desc: echo
          ? inCampaignRun
            ? 'Owned, but it only works in the Depthless Campaign. Not available in this run.'
            : `Lights up sharks within ${stats.radius} units for ${(stats.durationMs / 1000).toFixed(1)}s. Depthless Campaign only.`
          : hasClearedCampaign()
            ? 'Unlocked by clearing the campaign. Buy it in the Store.'
            : 'Locked until you clear the campaign.',
        value: echo ? (inCampaignRun ? 'Not this run' : 'Owned') : 'Locked',
        owned: echo && !inCampaignRun,
      },
    ];
    abilitiesEl.innerHTML = rows.map(rowHtml).join('');
  }

  function renderUpgrades(run: RunUpgrades | null | undefined): void {
    if (!upgradesEl) return;
    const inCampaignRun = run?.mode === 'campaign';
    if (upgradesNoteEl) {
      upgradesNoteEl.textContent = inCampaignRun
        ? 'Bought in the Store, but they seed Depthless runs only. None of them are in effect in this Campaign run.'
        : 'Bought in the Store. They seed a Depthless run and stack with the Mega Shrimp picks you make during it. The Campaign is untouched by them.';
    }
    // Dimmed rather than hidden during a Campaign run: the player still wants to see what they
    // own, they just need to know none of it is helping them right now.
    upgradesEl.classList.toggle('dolphin-list-inactive', inCampaignRun);
    const ids = Object.keys(UPGRADES) as UpgradeId[];
    upgradesEl.innerHTML = ids
      .map((id) => {
        const def = UPGRADES[id];
        const level = upgradeLevel(id);
        const max = def.prices.length;
        return rowHtml({
          icon: level > 0 ? '\u{1F7E2}' : '⚪',
          name: def.name,
          desc: def.desc,
          value: `${level} / ${max}`,
          owned: level > 0,
        });
      })
      .join('');
  }

  function renderPack(): void {
    const inventory = getInventory();
    const used = totalConsumablesHeld();

    if (packNoteEl) {
      packNoteEl.textContent =
        used === 0
          ? `All ${MAX_CONSUMABLE_SLOTS} slots empty. Any combination of the three kinds.`
          : `${used} of ${MAX_CONSUMABLE_SLOTS} slots used. Any combination of the three kinds.`;
    }

    if (!slotsEl) return;
    // One box per slot, filled left to right, so three of one kind and one of each read the
    // same way - as a pack with three places in it.
    const filled: string[] = [];
    for (const id of CONSUMABLE_ORDER) {
      for (let i = 0; i < inventory[id]; i++) filled.push(id);
    }
    const boxes: string[] = [];
    for (let slot = 0; slot < MAX_CONSUMABLE_SLOTS; slot++) {
      const id = filled[slot] as (typeof CONSUMABLE_ORDER)[number] | undefined;
      boxes.push(
        id
          ? `<div class="dolphin-slot filled">
              <div class="dolphin-slot-icon" aria-hidden="true">${CONSUMABLES[id].icon}</div>
              <div class="dolphin-slot-label">${CONSUMABLES[id].name}</div>
            </div>`
          : `<div class="dolphin-slot">
              <div class="dolphin-slot-icon" aria-hidden="true">·</div>
              <div class="dolphin-slot-label">Empty</div>
            </div>`,
      );
    }
    slotsEl.innerHTML = boxes.join('');
  }

  function refresh(run?: RunUpgrades | null): void {
    renderHero();
    renderRun(run);
    renderAbilities(run);
    renderUpgrades(run);
    renderPack();
  }

  document.getElementById('dolphinCloseBtn')?.addEventListener('click', () => {
    overlay?.classList.add('hidden');
  });
  document.getElementById('dolphinStoreBtn')?.addEventListener('click', () => {
    overlay?.classList.add('hidden');
    onOpenStore();
  });

  return {
    refresh,
    show(run?: RunUpgrades | null): void {
      refresh(run);
      overlay?.classList.remove('hidden');
    },
    hide(): void {
      overlay?.classList.add('hidden');
    },
    get visible(): boolean {
      return !!overlay && !overlay.classList.contains('hidden');
    },
  };
}
