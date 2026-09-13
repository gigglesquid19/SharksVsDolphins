#!/usr/bin/env python3
"""Snap a generated sprite onto the palette the existing artwork is drawn from.

A generator asked to match a style gets the silhouette roughly right and the
colours approximately right, and "approximately" is what reads as off. Every
pixel here is moved to its nearest neighbour in a fixed palette (see
sprite_palette.py), which makes colour fit deterministic instead of hoped-for.
Silhouette and line weight still need your eye; colour stops being a variable.

Alpha is hardened at the same time. Pixel art has no semitransparent edges, but
a generated sprite usually arrives with a soft halo around it, which shimmers
once PixiJS scales it with `scaleMode = 'nearest'`.

Run from the repo root:

    python tools/clamp_sprite_palette.py incoming/boss.png -o public/sharks/boss.png
    python tools/clamp_sprite_palette.py incoming/*.png --in-place
    python tools/clamp_sprite_palette.py boss.png --allow '#c81e3c,#ff7a4d' -o boss_clamped.png

A boss with an accent colour the shark pack has never contained - red
photophores, a gold marking - would have that accent crushed to the nearest
grey by a strict clamp. Pass those colours to --allow to widen the target
palette rather than fighting it.
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image

from sprite_palette import DEFAULT_OUT as DEFAULT_PALETTE, load_palette, to_hex

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ALPHA_THRESHOLD = 128


def parse_hex(value: str) -> tuple[int, int, int]:
    text = value.strip().lstrip("#")
    if len(text) != 6:
        raise argparse.ArgumentTypeError(f"expected #rrggbb, got {value!r}")
    try:
        n = int(text, 16)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"not a hex colour: {value!r}") from exc
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    """Redmean distance - a cheap approximation that tracks perceived difference.

    Plain RGB distance happily swaps a mid blue for a mid green because they sit
    the same number of units apart, which is exactly the substitution that makes
    a clamped sprite look wrong.
    """
    rmean = (a[0] + b[0]) / 2
    dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return ((2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db) ** 0.5


def clamp_image(
    img: Image.Image,
    palette: list[tuple[int, int, int]],
    alpha_threshold: int,
) -> tuple[Image.Image, int, int]:
    """Return the clamped image plus (pixels moved, opaque pixels)."""
    rgba = img.convert("RGBA")
    # Work on the raw RGBA bytes rather than getdata/putdata, which Pillow 14
    # drops. Sprites are small, so the cost is in the nearest-colour search -
    # hence the cache, which turns it into one search per distinct colour.
    buf = bytearray(rgba.tobytes())
    nearest: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    moved = opaque = 0

    for i in range(0, len(buf), 4):
        if buf[i + 3] < alpha_threshold:
            buf[i : i + 4] = b"\x00\x00\x00\x00"
            continue
        opaque += 1
        key = (buf[i], buf[i + 1], buf[i + 2])
        target = nearest.get(key)
        if target is None:
            target = min(palette, key=lambda c: distance(key, c))
            nearest[key] = target
        if target != key:
            moved += 1
        buf[i], buf[i + 1], buf[i + 2], buf[i + 3] = (*target, 255)

    clamped = Image.frombytes("RGBA", rgba.size, bytes(buf))
    return clamped, moved, opaque


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("sources", nargs="+", type=Path, help="sprite PNGs to clamp")
    parser.add_argument("-o", "--out", type=Path, help="output path (single source only)")
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="overwrite each source, keeping a .orig.png copy alongside it",
    )
    parser.add_argument("--palette", type=Path, default=DEFAULT_PALETTE)
    parser.add_argument(
        "--allow",
        type=str,
        default="",
        help="extra hex colours to add to the target palette, comma separated",
    )
    parser.add_argument("--alpha-threshold", type=int, default=DEFAULT_ALPHA_THRESHOLD)
    args = parser.parse_args()

    if args.out and len(args.sources) > 1:
        raise SystemExit("--out takes a single source; use --in-place for several")
    if not args.out and not args.in_place:
        raise SystemExit("pass either --out or --in-place")
    if not args.palette.exists():
        raise SystemExit(f"no palette at {args.palette} - run tools/sprite_palette.py first")

    palette = load_palette(args.palette)
    extra = [parse_hex(c) for c in args.allow.split(",") if c.strip()]
    for colour in extra:
        if colour not in palette:
            palette.append(colour)

    print(f"palette: {len(palette)} colours", end="")
    if extra:
        print(" (+" + ", ".join(to_hex(c) for c in extra) + ")", end="")
    print()

    for source in args.sources:
        if not source.exists():
            raise SystemExit(f"no such file: {source}")
        with Image.open(source) as img:
            clamped, moved, opaque = clamp_image(img, palette, args.alpha_threshold)

        if args.in_place:
            backup = source.with_suffix(".orig.png")
            if not backup.exists():
                shutil.copy2(source, backup)
            destination = source
        else:
            destination = args.out
            destination.parent.mkdir(parents=True, exist_ok=True)

        clamped.save(destination)
        share = (moved / opaque * 100) if opaque else 0.0
        print(f"  {source.name} -> {destination.name}  {moved}/{opaque} px moved ({share:.1f}%)")


if __name__ == "__main__":
    main()
