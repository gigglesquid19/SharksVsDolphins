import { getPearls } from './pearls';
import {
  ECHOLOCATION_PRICE,
  UPGRADES,
  UpgradeId,
  buyEcholocation,
  buySkin,
  buyUpgrade,
  canBuyUpgrade,
  echolocationStats,
  echolocationUnlocked,
  equipSkin,
  equippedSkinId,
  nextUpgradeCost,
  ownsEcholocation,
  ownsSkin,
  upgradeLevel,
} from './store';
import {
  CONSUMABLES,
  CONSUMABLE_ORDER,
  MAX_CONSUMABLE_SLOTS,
  buyConsumable,
  getInventory,
  packFull,
  totalConsumablesHeld,
} from './inventory';
import type { DolphinSkin } from './skins';
import { DOLPHIN_SKINS } from './skins';
import { recommendPurchase } from './recommendation';
import { makeDolphinBodyCanvas } from './sprites';

/**
 * Renders and wires the Store screen (#storeScreen in index.html). All money
 * mutations go through src/store.ts; this module only reads state and paints
 * DOM, re-rendering after every purchase.
 */
export function setupStore(opts: { onPearlsChange: () => void }): { open: () => void } {
  const screen = document.getElementById('storeScreen') as HTMLDivElement;
  const pearlsNumberEl = document.getElementById('storePearlsNumber') as HTMLElement;
  const upgradesEl = document.getElementById('storeUpgrades') as HTMLDivElement;
  const abilitiesEl = document.getElementById('storeAbilities') as HTMLDivElement;
  const consumablesEl = document.getElementById('storeConsumables') as HTMLDivElement;
  const consumablesNoteEl = document.getElementById('storeConsumablesNote') as HTMLElement | null;
  const recommendEl = document.getElementById('storeRecommend') as HTMLDivElement | null;
  const recommendNameEl = document.getElementById('storeRecommendName');
  const recommendReasonEl = document.getElementById('storeRecommendReason');
  const recommendCostEl = document.getElementById('storeRecommendCost');
  const skinsEl = document.getElementById('storeSkins') as HTMLDivElement;
  const nationSkinsEl = document.getElementById('storeNationSkins') as HTMLDivElement;
  const closeBtn = document.getElementById('storeCloseBtn') as HTMLButtonElement;

  /**
   * Magic Shrimp: the only item here that is spent rather than owned. It used to appear in the
   * water mid-level, where a shark could reach it first and grow large - a coin flip the player
   * could not influence. Bought and carried, it becomes a decision instead.
   */
  function renderConsumables(): void {
    const balance = getPearls();
    const inventory = getInventory();
    // The pack has three slots shared across every kind, so the tiles have to speak about the
    // pack rather than about themselves - otherwise a tile reading "Carrying 1 / 3" with a
    // disabled buy button looks broken.
    const slotsUsed = totalConsumablesHeld();
    const noRoom = packFull();
    if (consumablesNoteEl) {
      consumablesNoteEl.textContent = noRoom
        ? `Pack full - ${slotsUsed} of ${MAX_CONSUMABLE_SLOTS} slots. Spend one in a run to make room.`
        : `${slotsUsed} of ${MAX_CONSUMABLE_SLOTS} slots used. Any combination of the three.`;
    }

    const tiles = CONSUMABLE_ORDER.map((id) => {
      const def = CONSUMABLES[id];
      const held = inventory[id];
      const full = noRoom || held >= def.max;

      const item = document.createElement('div');
      item.className = 'store-item';
      if (full) item.classList.add('owned');

      item.innerHTML = `
        <div class="store-item-icon" aria-hidden="true">${def.icon}</div>
        <div class="store-item-name">${def.name}</div>
        <div class="store-item-desc">${def.desc} Press <b>${def.key}</b> in a run.</div>
        <div class="store-item-level">Carrying ${held}</div>`;

      const btn = document.createElement('button');
      btn.className = 'store-buy';
      if (full) {
        btn.textContent = noRoom ? 'Pack full' : 'Max of this kind';
        btn.disabled = true;
      } else {
        btn.innerHTML = `<img class="pearl-icon" alt="" src="${pearlIconSrc()}"> ${def.price}`;
        btn.disabled = balance < def.price;
        btn.addEventListener('click', () => {
          if (buyConsumable(id)) refresh();
        });
      }
      item.appendChild(btn);
      return item;
    });
    consumablesEl.replaceChildren(...tiles);
  }

  /**
   * Echolocation: locked until the campaign has been cleared, then a one-off purchase. Shown even
   * while locked, with the reason on the button, so the campaign has something to point at.
   */
  function renderAbilities(): void {
    const balance = getPearls();
    const owned = ownsEcholocation();
    const unlocked = echolocationUnlocked();
    const stats = echolocationStats();

    const item = document.createElement('div');
    item.className = 'store-item';
    if (owned) item.classList.add('owned');
    if (!unlocked) item.classList.add('locked');

    const seconds = (stats.durationMs / 1000).toFixed(1).replace(/\.0$/, '');
    item.innerHTML = `
      <div class="store-item-icon" aria-hidden="true">🔊</div>
      <div class="store-item-name">Echolocation</div>
      <div class="store-item-desc">Ping the water to see cloaked tiger sharks and anything a storm is hiding.</div>
      <div class="store-item-level">${owned ? `${seconds}s &middot; ${stats.radius} units` : 'Depthless Campaign only'}</div>`;

    const btn = document.createElement('button');
    btn.className = 'store-buy';
    if (owned) {
      btn.textContent = 'Owned';
      btn.disabled = true;
    } else if (!unlocked) {
      btn.textContent = '🔒 Clear the campaign';
      btn.disabled = true;
    } else {
      btn.innerHTML = `<img class="pearl-icon" alt="" src="${pearlIconSrc()}"> ${ECHOLOCATION_PRICE}`;
      btn.disabled = balance < ECHOLOCATION_PRICE;
      btn.addEventListener('click', () => {
        if (buyEcholocation()) refresh();
      });
    }
    item.appendChild(btn);
    abilitiesEl.replaceChildren(item);
  }

  function renderUpgrades(): void {
    const balance = getPearls();
    upgradesEl.replaceChildren(
      ...(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
        const def = UPGRADES[id];
        const level = upgradeLevel(id);
        const max = def.prices.length;
        const cost = nextUpgradeCost(id);

        const item = document.createElement('div');
        item.className = 'store-item';
        const maxed = cost === null;
        const affordable = cost !== null && balance >= cost;
        // Echo upgrades exist in the list before the ability is bought, so their cost is visible,
        // but they cannot be bought - buyUpgrade refuses them too, not just the button.
        const gated = !canBuyUpgrade(id) && !maxed;
        if (gated) item.classList.add('locked');

        const btn = document.createElement('button');
        btn.className = 'store-buy';
        if (maxed) {
          btn.textContent = 'Maxed';
          btn.disabled = true;
        } else if (gated) {
          btn.textContent = '🔒 Needs Echolocation';
          btn.disabled = true;
        } else {
          btn.innerHTML = `<img class="pearl-icon" alt="" src="${pearlIconSrc()}"> ${cost}`;
          btn.disabled = !affordable;
          btn.addEventListener('click', () => {
            if (buyUpgrade(id)) refresh();
          });
        }

        item.innerHTML = `
          <div class="store-item-name">${def.name}</div>
          <div class="store-item-desc">${def.desc}</div>
          <div class="store-item-level">Lv ${level} / ${max}</div>`;
        item.appendChild(btn);
        return item;
      }),
    );
  }

  /** Renders one shelf of skins. Both shelves behave identically; they are split only so the
   *  twenty national skins do not bury the original eight. */
  function renderSkins(target: HTMLDivElement, group: DolphinSkin['group']): void {
    const balance = getPearls();
    const equipped = equippedSkinId();
    target.replaceChildren(
      ...DOLPHIN_SKINS.filter((skin) => skin.group === group).map((skin) => {
        const owned = ownsSkin(skin.id);
        const isEquipped = skin.id === equipped;

        const item = document.createElement('div');
        item.className = 'store-item';
        if (owned) item.classList.add('owned');
        if (isEquipped) item.classList.add('equipped');
        const lockedReward = skin.source === 'reward' && !owned;
        if (lockedReward) item.classList.add('locked');

        const preview = document.createElement('canvas');
        preview.className = 'store-skin-preview';
        preview.width = 132;
        preview.height = 88;
        const pctx = preview.getContext('2d');
        if (pctx) {
          const body = makeDolphinBodyCanvas(skin.palette);
          pctx.imageSmoothingQuality = 'high';
          pctx.drawImage(body, 0, 0, body.width, body.height, 0, 0, preview.width, preview.height);
        }
        item.appendChild(preview);

        const name = document.createElement('div');
        name.className = 'store-item-name';
        name.textContent = skin.name;
        item.appendChild(name);

        const btn = document.createElement('button');
        btn.className = 'store-buy';
        if (isEquipped) {
          btn.textContent = 'Equipped';
          btn.disabled = true;
        } else if (owned) {
          btn.textContent = 'Equip';
          btn.addEventListener('click', () => {
            if (equipSkin(skin.id)) refresh();
          });
        } else if (lockedReward) {
          btn.textContent = '🔒 Share to unlock';
          btn.disabled = true;
        } else {
          btn.innerHTML = `<img class="pearl-icon" alt="" src="${pearlIconSrc()}"> ${skin.price}`;
          btn.disabled = balance < skin.price;
          btn.addEventListener('click', () => {
            if (buySkin(skin.id)) refresh();
          });
        }
        item.appendChild(btn);
        return item;
      }),
    );
  }

  /**
   * One suggestion, above everything the Store sells. Recomputed on every refresh, so buying the
   * thing it just recommended immediately moves it on to the next - which is the only way the
   * advice stays true while the player is spending.
   */
  function renderRecommendation(): void {
    if (!recommendEl) return;
    const rec = recommendPurchase();
    recommendEl.classList.toggle('hidden', !rec);
    if (!rec) return;

    if (recommendNameEl) recommendNameEl.textContent = rec.name;
    if (recommendReasonEl) recommendReasonEl.textContent = rec.reason;
    if (recommendCostEl) {
      recommendCostEl.classList.toggle('short', !rec.affordable);
      recommendCostEl.innerHTML = rec.affordable
        ? `<img class="pearl-icon" alt="" src="${pearlIconSrc()}"> ${rec.price} - you can afford this now`
        : `<img class="pearl-icon" alt="" src="${pearlIconSrc()}"> ${rec.price} - ${rec.shortfall} more to go`;
    }
  }

  function refresh(): void {
    pearlsNumberEl.textContent = String(getPearls());
    renderRecommendation();
    renderConsumables();
    renderAbilities();
    renderUpgrades();
    renderSkins(skinsEl, 'ocean');
    renderSkins(nationSkinsEl, 'nation');
    opts.onPearlsChange();
  }

  closeBtn.addEventListener('click', () => screen.classList.add('hidden'));

  return {
    open(): void {
      refresh();
      screen.classList.remove('hidden');
    },
  };
}

/** The already-resolved pearl icon URL, borrowed from the header <img> main.ts rewrote. */
function pearlIconSrc(): string {
  const header = document.querySelector('#storePearls img.pearl-icon') as HTMLImageElement | null;
  return header?.src || `${import.meta.env.BASE_URL}pearl.png`;
}
