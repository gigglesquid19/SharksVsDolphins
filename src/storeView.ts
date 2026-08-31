import { getPearls } from './pearls';
import {
  UPGRADES,
  UpgradeId,
  buySkin,
  buyUpgrade,
  equipSkin,
  equippedSkinId,
  nextUpgradeCost,
  ownsSkin,
  upgradeLevel,
} from './store';
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
  const skinsEl = document.getElementById('storeSkins') as HTMLDivElement;
  const closeBtn = document.getElementById('storeCloseBtn') as HTMLButtonElement;

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

        const btn = document.createElement('button');
        btn.className = 'store-buy';
        if (maxed) {
          btn.textContent = 'Maxed';
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
