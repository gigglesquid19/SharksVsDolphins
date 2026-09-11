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
  MAGIC_SHRIMP_PRICE,
  MAX_MAGIC_SHRIMP,
  buyMagicShrimp,
  magicShrimpHeld,
} from './inventory';
import { DOLPHIN_SKINS } from './skins';
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
  const skinsEl = document.getElementById('storeSkins') as HTMLDivElement;
  const closeBtn = document.getElementById('storeCloseBtn') as HTMLButtonElement;

  /**
   * Magic Shrimp: the only item here that is spent rather than owned. It used to appear in the
   * water mid-level, where a shark could reach it first and grow large - a coin flip the player
   * could not influence. Bought and carried, it becomes a decision instead.
   */
  function renderConsumables(): void {
    const balance = getPearls();
    const held = magicShrimpHeld();
    const full = held >= MAX_MAGIC_SHRIMP;

    const item = document.createElement('div');
    item.className = 'store-item';
    if (full) item.classList.add('owned');

    item.innerHTML = `
      <div class="store-item-icon" aria-hidden="true">\u{1F990}</div>
      <div class="store-item-name">Magic Shrimp</div>
      <div class="store-item-desc">Use it mid-run for double swim speed that lasts the rest of the level.</div>
      <div class="store-item-level">Carrying ${held} / ${MAX_MAGIC_SHRIMP}</div>`;

    const btn = document.createElement('button');
    btn.className = 'store-buy';
    if (full) {
      btn.textContent = 'Pack full';
      btn.disabled = true;
    } else {
      btn.innerHTML = `<img class="pearl-icon" alt="" src="${pearlIconSrc()}"> ${MAGIC_SHRIMP_PRICE}`;
      btn.disabled = balance < MAGIC_SHRIMP_PRICE;
      btn.addEventListener('click', () => {
        if (buyMagicShrimp()) refresh();
      });
    }
    item.appendChild(btn);
    consumablesEl.replaceChildren(item);
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
      <div class="store-item-level">${owned ? `${seconds}s &middot; ${stats.radius} units` : 'Endless Mode only'}</div>`;

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

  function renderSkins(): void {
    const balance = getPearls();
    const equipped = equippedSkinId();
    skinsEl.replaceChildren(
      ...DOLPHIN_SKINS.map((skin) => {
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

  function refresh(): void {
    pearlsNumberEl.textContent = String(getPearls());
    renderConsumables();
    renderAbilities();
    renderUpgrades();
    renderSkins();
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
