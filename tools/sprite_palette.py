#!/usr/bin/env python3
"""Extract the working colour palette from a set of reference sprites.

The shark pack in public/sharks/ reports 465 distinct opaque colours, but that
is mostly noise: the six strips were saved through a lossy step, so each real
colour sits at the centre of a little cloud of near-duplicates (#000000,
#000101, #010101, #000001 are all the same black). Merging anything within a
small RGB radius collapses those clouds and leaves the ~15 colours the artwork
is actually built from.

That short list is what makes generated sprites matchable: clamp_sprite_palette
snaps a new sprite onto it, so colour fit stops depending on whether the
generator felt like cooperating.

Run from the repo root:

    python tools/sprite_palette.py                     # the shark pack -> tools/shark_palette.json
    python tools/sprite_palette.py --print             # show it, write nothing
    python tools/sprite_palette.py path/to/*.png -o tools/boss_palette.json

Tuning: --threshold widens or narrows what counts as "the same colour"
(28 suits the shark pack); --min-share drops clusters too rare to be part of
the style rather than a stray pixel.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCES = sorted((ROOT / "public" / "sharks").glob("*.png"))
DEFAULT_OUT = ROOT / "tools" / "shark_palette.json"

# Colours closer together than this (plain RGB distance) are treated as one.
DEFAULT_THRESHOLD = 28.0
# Clusters covering less than this share of opaque pixels are discarded.
DEFAULT_MIN_SHARE = 0.004
# Pixels at or below this alpha are ignored; pixel art has no real semitransparency.
ALPHA_FLOOR = 128


def count_colours(paths: list[Path]) -> Counter[tuple[int, int, int]]:
    """Tally every opaque pixel across the reference images."""
    counts: Counter[tuple[int, int, int]] = Counter()
    for path in paths:
        with Image.open(path) as img:
            rgba = img.convert("RGBA")
            # getcolors over the whole 24-bit space: one pass in C, and unlike
            # getdata it is not on Pillow's deprecation list.
            for n, (r, g, b, a) in rgba.getcolors(maxcolors=1 << 24) or []:
                if a >= ALPHA_FLOOR:
                    counts[(r, g, b)] += n
    return counts


def merge_clusters(
    counts: Counter[tuple[int, int, int]],
    threshold: float,
    min_share: float,
) -> list[dict]:
    """Greedily absorb near-duplicates into the most common colour near them.

    Walking most-common-first matters: the cluster centre ends up being the
    colour the artist actually used, not whichever compression artefact was
    encountered first.
    """
    total = sum(counts.values())
    if total == 0:
        return []

    clusters: list[dict] = []
    for (r, g, b), n in counts.most_common():
        for cluster in clusters:
            cr, cg, cb = cluster["rgb"]
            if ((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2) ** 0.5 < threshold:
                cluster["count"] += n
                break
        else:
            clusters.append({"rgb": (r, g, b), "count": n})

    kept = [c for c in clusters if c["count"] / total >= min_share]
    kept.sort(key=lambda c: c["count"], reverse=True)
    for cluster in kept:
        cluster["share"] = cluster["count"] / total
    return kept


def to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def load_palette(path: Path) -> list[tuple[int, int, int]]:
    """Read a palette JSON written by this tool. Used by clamp_sprite_palette."""
    data = json.loads(path.read_text(encoding="utf-8"))
    return [tuple(entry["rgb"]) for entry in data["colours"]]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "sources",
        nargs="*",
        type=Path,
        help="reference PNGs (default: every sprite in public/sharks/)",
    )
    parser.add_argument("-o", "--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--min-share", type=float, default=DEFAULT_MIN_SHARE)
    parser.add_argument(
        "--print",
        dest="print_only",
        action="store_true",
        help="print the palette without writing a file",
    )
    args = parser.parse_args()

    sources = args.sources or DEFAULT_SOURCES
    missing = [p for p in sources if not p.exists()]
    if missing:
        raise SystemExit("no such file: " + ", ".join(str(p) for p in missing))
    if not sources:
        raise SystemExit("no reference images found")

    counts = count_colours(sources)
    clusters = merge_clusters(counts, args.threshold, args.min_share)
    total = sum(counts.values())

    print(f"{len(sources)} image(s), {total} opaque pixels, {len(counts)} raw colours")
    print(f"merged at threshold {args.threshold:g} -> {len(clusters)} palette colours\n")
    for cluster in clusters:
        print(f"  {to_hex(cluster['rgb']):<9} {cluster['share'] * 100:5.2f}%")

    if args.print_only:
        return

    payload = {
        "sources": [str(p.relative_to(ROOT)).replace("\\", "/") for p in sources],
        "threshold": args.threshold,
        "min_share": args.min_share,
        "colours": [
            {"hex": to_hex(c["rgb"]), "rgb": list(c["rgb"]), "share": round(c["share"], 5)}
            for c in clusters
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {args.out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
