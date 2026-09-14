import { sharkArt, specialSharkArt, type SharkArt, type SharkStrip } from './game';
import { SHARKOPEDIA, UNKNOWN_NAME, encounteredEntries, type SharkopediaEntry } from './sharkopedia';

/**
 * The Sharkopedia screen.
 *
 * Every shark in the game gets a card, met or not. An unmet one keeps its place in the order and
 * shows a shadow and a row of question marks, so the book reads as a book with gaps rather than
 * as a short list - what is missing, and roughly how much of it, is the point of opening it.
 *
 * The cards are painted rather than illustrated. There is no second set of artwork: each one is
 * frame zero of the same strip the shark swims on, stretched and tinted with the same numbers
 * (see sharkArt), drawn onto a small canvas. A shadow is that same silhouette filled flat - and
 * deliberately always the *same* silhouette, the great white's, so an unmet card gives away that
 * something is there without giving away what.
 */

const BASE = import.meta.env.BASE_URL;

const STRIP_SRC: Record<SharkStrip, string> = {
  greatWhite: `${BASE}sharks/spr_shark_move_strip9.png`,
  hammerhead: `${BASE}sharks/spr_hammerhead_shark_move_strip9.png`,
  tiger: `${BASE}sharks/spr_tiger_shark_move_strip9.png`,
};

/** The strips are nine frames laid out horizontally. */
const STRIP_FRAMES = 9;

/** The card's drawing area, in CSS pixels. Everything is fitted inside this box. */
const CARD_ART_W = 170;
const CARD_ART_H = 110;

/**
 * How hard the size difference between entries is squashed, as an exponent on the drawn scale.
 *
 * At true scale the book is honest and unreadable. A grown great white is nearly six times the
 * height of a juvenile cookiecutter, so fitting the great white into a card leaves the
 * cookiecutter a smudge about fifteen pixels tall - accurate, and no use to anyone trying to
 * learn what one looks like.
 *
 * A square root keeps the order and most of the feeling - the great white is still three times
 * the cookiecutter on the page - while lifting the smallest entries to something you can actually
 * read. Proportion is deliberately left alone: only overall size is compressed, so a frilled
 * shark still stretches into an eel and a cookiecutter is still stubby.
 */
const SIZE_COMPRESSION = 0.5;

/**
 * What a shadow is filled with.
 *
 * Lighter than the card, not darker. The panel behind it is already near-black, so a shadow
 * painted the way a shadow is usually painted was a black shape on a black card and simply could
 * not be seen - the silhouette was there and read as an empty box. A pale slate shape against
 * dark water is what "something out there" actually looks like from inside a submarine.
 */
const SHADOW_FILL = '#3b5472';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadStrip(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
  imageCache.set(src, loading);
  return loading;
}

/**
 * Paints one frame onto a canvas, stretched to the entry's proportions and fitted to the box.
 *
 * `tint` is a multiply, applied the way a sprite applies it: paint the frame, multiply a flat
 * colour over it, then clip the result back to the frame's own alpha so only the animal is
 * coloured and not the card behind it. `shadow` skips the tint and fills flat instead.
 */
/** The art an entry is drawn from: its species at its size, unless it is one of the two specials. */
function artFor(entry: SharkopediaEntry): SharkArt {
  return entry.special ? specialSharkArt(entry.special) : sharkArt(entry.kind, entry.large);
}

/** The drawn size of an entry, in frames - its true scale, squashed by SIZE_COMPRESSION. */
function drawScale(scale: number): number {
  return scale ** SIZE_COMPRESSION;
}

/**
 * The widest and tallest anything in the book gets, measured in frames.
 *
 * Taken across the roster rather than per card, and per axis rather than as one number: the
 * longest entry (a grown frilled shark) and the tallest (a grown great white) are different
 * animals, and treating either as if it were both square would shrink every card to fit a size
 * nothing actually is.
 *
 * The Matriarch and the megamouth are left out of it on purpose. They are two and three times a
 * grown great white, so letting them set the ruler would shrink every ordinary shark to fit them
 * and put the cookiecutter back where it started. Left out, they run past the end of the ruler
 * and are clamped to their card instead - which is the correct impression of both.
 */
function ruler(): { w: number; h: number } {
  return SHARKOPEDIA.filter((entry) => !entry.special).reduce(
    (max, entry) => {
      const art = artFor(entry);
      const scale = drawScale(art.scale);
      return { w: Math.max(max.w, art.stretchX * scale), h: Math.max(max.h, art.stretchY * scale) };
    },
    { w: 0, h: 0 },
  );
}

/**
 * Lays the belly lights over a painted shark.
 *
 * The spots are in the strip's own frame coordinates, exactly as the sprite places them, so the
 * same numbers land on the same part of the animal at whatever size the card draws it. Painted
 * additively in three rings - a bright core inside a wide soft halo - which is the shape the
 * sprite's own lights are built from, and the reason they read as something lit rather than as a
 * dot someone put there.
 *
 * The dot grows with the animal but not all the way: on a juvenile cookiecutter, drawn barely
 * forty pixels across, lights in true proportion would be a speck, and the lights are how that
 * shark is recognised at all.
 */
function paintLights(
  ctx: CanvasRenderingContext2D,
  art: Pick<SharkArt, 'photophores' | 'photophoreColor' | 'eyes' | 'eyeColor'>,
  box: { x: number; y: number; w: number; h: number },
  frameW: number,
  frameH: number,
): void {
  const perX = box.w / frameW;
  const perY = box.h / frameH;
  const at = (spot: { x: number; y: number }): [number, number] => [
    box.x + box.w / 2 + spot.x * perX,
    box.y + box.h / 2 + spot.y * perY,
  ];
  const core = Math.min(3.2, Math.max(1.5, perX * 1.9));

  const spots = art.photophores;
  if (spots && spots.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `#${(art.photophoreColor ?? 0xffffff).toString(16).padStart(6, '0')}`;
    for (const spot of spots) {
      const [cx, cy] = at(spot);
      for (const [radius, alpha] of [
        [core * 4.6, 0.2],
        [core * 2.3, 0.5],
        [core, 1],
      ] as const) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Eyes are painted flat, over the top - no halo and no additive blend, because an eye is not a
  // light the animal is making. Small, and on the head rather than the belly.
  const eyes = art.eyes;
  if (eyes && eyes.length > 0) {
    ctx.save();
    ctx.fillStyle = `#${(art.eyeColor ?? 0x4ade80).toString(16).padStart(6, '0')}`;
    for (const spot of eyes) {
      const [cx, cy] = at(spot);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.4, core * 0.72), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function paint(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  art: Pick<SharkArt, 'tint' | 'stretchX' | 'stretchY' | 'scale' | 'photophores' | 'photophoreColor' | 'eyes' | 'eyeColor'>,
  shadow: boolean,
  largestScale: { w: number; h: number },
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CARD_ART_W * dpr;
  canvas.height = CARD_ART_H * dpr;
  canvas.style.width = `${CARD_ART_W}px`;
  canvas.style.height = `${CARD_ART_H}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(dpr, dpr);

  const frameW = img.width / STRIP_FRAMES;
  const frameH = img.height;

  // Every card is drawn against the same ruler, so a juvenile is visibly smaller than its adult
  // and the species are ordered by size at a glance - see ruler() and SIZE_COMPRESSION.
  const wantW = frameW * art.stretchX * drawScale(art.scale);
  const wantH = frameH * art.stretchY * drawScale(art.scale);
  const fit = Math.min(CARD_ART_W / (frameW * largestScale.w), CARD_ART_H / (frameH * largestScale.h));
  // Anything past the end of the ruler - the two specials - is held to its card rather than
  // spilling out of it.
  const over = Math.max((wantW * fit) / CARD_ART_W, (wantH * fit) / CARD_ART_H, 1);
  const w = (wantW * fit) / over;
  const h = (wantH * fit) / over;
  const x = (CARD_ART_W - w) / 2;
  const y = (CARD_ART_H - h) / 2;

  ctx.drawImage(img, 0, 0, frameW, frameH, x, y, w, h);

  ctx.globalCompositeOperation = shadow ? 'source-atop' : 'multiply';
  ctx.fillStyle = shadow ? SHADOW_FILL : `#${art.tint.toString(16).padStart(6, '0')}`;
  ctx.fillRect(x, y, w, h);

  if (!shadow) {
    // Multiply painted the whole rectangle; clip it back to the animal.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0, frameW, frameH, x, y, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Lights and eyes last, and never on a shadow: which species carries them, and where, is
  // exactly the sort of thing an unmet card must not give away.
  if (!shadow) paintLights(ctx, art, { x, y, w, h }, frameW, frameH);
}

function card(entry: SharkopediaEntry, met: boolean, largestScale: { w: number; h: number }): HTMLElement {
  const el = document.createElement('div');
  el.className = met ? 'pedia-card' : 'pedia-card unknown';

  const art = document.createElement('div');
  art.className = 'pedia-art';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    met ? `${entry.name}, ${entry.stage}` : 'An unidentified shark, shown as a shadow',
  );
  art.appendChild(canvas);
  el.appendChild(art);

  const shape = met ? artFor(entry) : sharkArt('greatWhite', true);
  void loadStrip(STRIP_SRC[shape.strip])
    .then((img) => paint(canvas, img, shape, !met, largestScale))
    .catch(() => {
      // No artwork is better than a broken one: the card keeps its text and loses its picture.
      art.remove();
    });

  const name = document.createElement('h3');
  name.className = 'pedia-name';
  name.textContent = met ? entry.name : UNKNOWN_NAME;
  el.appendChild(name);

  const stage = document.createElement('p');
  stage.className = 'pedia-stage';
  stage.textContent = met ? (entry.stage === 'juvenile' ? 'Juvenile' : 'Adult') : UNKNOWN_NAME;
  el.appendChild(stage);

  const body = document.createElement('p');
  body.className = 'pedia-desc';
  body.textContent = met ? entry.description : 'You have not met this one yet.';
  el.appendChild(body);

  if (met && entry.pod) {
    const pod = document.createElement('p');
    pod.className = 'pedia-pod';
    pod.innerHTML = `<span>Pod to ram</span><span>${entry.pod}${entry.large ? ' + Boost' : ''}</span>`;
    el.appendChild(pod);
  }
  return el;
}

export interface SharkopediaView {
  open(): void;
  close(): void;
}

/**
 * Wires the screen up once and fills it in each time it opens, so a shark met since the last look
 * has its page waiting.
 */
export function setupSharkopedia(): SharkopediaView {
  const screen = document.getElementById('sharkopediaScreen');
  const grid = document.getElementById('sharkopediaGrid');
  const progress = document.getElementById('sharkopediaProgress');
  const backBtn = document.getElementById('sharkopediaBackBtn');

  const close = (): void => screen?.classList.add('hidden');

  const open = (): void => {
    if (!screen || !grid) return;
    const met = encounteredEntries();
    const largestScale = ruler();

    grid.innerHTML = '';
    for (const entry of SHARKOPEDIA) grid.appendChild(card(entry, met.has(entry.id), largestScale));

    if (progress) {
      const found = SHARKOPEDIA.filter((entry) => met.has(entry.id)).length;
      progress.textContent =
        found === 0
          ? `Nothing recorded yet - ${SHARKOPEDIA.length} to find`
          : `${found} of ${SHARKOPEDIA.length} recorded`;
    }
    screen.classList.remove('hidden');
  };

  backBtn?.addEventListener('click', close);
  return { open, close };
}
