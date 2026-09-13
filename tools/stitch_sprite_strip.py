#!/usr/bin/env python3
"""Fold a folder of animation frames into one horizontal strip.

src/sprites.ts slices a shark's animation out of a single image: nine 64x64
frames laid left to right, cut by `sliceSharkStrip`. Frame generators hand back
one file per frame instead, so they need folding into that layout before the
game can load them.

Frames are ordered by the number in their filename rather than by string sort,
so frame_10 lands after frame_9 instead of after frame_1.

Run from the repo root:

    python tools/stitch_sprite_strip.py incoming/swim_*.png -o public/sharks/spr_reef_shark_move_strip9.png
    python tools/stitch_sprite_strip.py incoming/frames --frames 9 -o out.png

A mismatch against the expected frame count or the 64x64 frame size is refused
rather than warned about: both produce a strip that loads without error and
animates as garbage, which is a slow thing to debug from the game side.
Override with --frames / --frame-size when a sprite genuinely differs - a boss
drawn at 128x128, say.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# Matches SHARK_FRAME_COUNT / SHARK_FRAME_SIZE in src/sprites.ts.
DEFAULT_FRAME_COUNT = 9
DEFAULT_FRAME_SIZE = 64

TRAILING_NUMBER = re.compile(r"(\d+)(?!.*\d)")


def frame_order(path: Path) -> tuple[int, str]:
    """Sort key: the last number in the filename, falling back to the name."""
    match = TRAILING_NUMBER.search(path.stem)
    return (int(match.group(1)) if match else 0, path.stem)


def collect_frames(sources: list[Path]) -> list[Path]:
    """Expand a directory argument into its PNGs, then order everything."""
    frames: list[Path] = []
    for source in sources:
        if source.is_dir():
            frames.extend(source.glob("*.png"))
        elif source.exists():
            frames.append(source)
        else:
            raise SystemExit(f"no such file: {source}")
    return sorted(frames, key=frame_order)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("sources", nargs="+", type=Path, help="frame PNGs, or a folder of them")
    parser.add_argument("-o", "--out", type=Path, required=True)
    parser.add_argument("--frames", type=int, default=DEFAULT_FRAME_COUNT)
    parser.add_argument("--frame-size", type=int, default=DEFAULT_FRAME_SIZE)
    parser.add_argument(
        "--any-size",
        action="store_true",
        help="accept whatever size the frames are, as long as they agree",
    )
    args = parser.parse_args()

    frames = collect_frames(args.sources)
    if not frames:
        raise SystemExit("no frames found")
    if len(frames) != args.frames:
        listing = "\n".join(f"  {p.name}" for p in frames)
        raise SystemExit(
            f"expected {args.frames} frames, found {len(frames)}:\n{listing}\n"
            "pass --frames to stitch a different count"
        )

    images = [Image.open(p).convert("RGBA") for p in frames]
    sizes = {img.size for img in images}
    if len(sizes) != 1:
        raise SystemExit("frames differ in size: " + ", ".join(f"{w}x{h}" for w, h in sorted(sizes)))

    width, height = sizes.pop()
    if not args.any_size and (width, height) != (args.frame_size, args.frame_size):
        raise SystemExit(
            f"frames are {width}x{height}, expected {args.frame_size}x{args.frame_size}; "
            "pass --frame-size or --any-size if that is intended"
        )

    strip = Image.new("RGBA", (width * len(images), height))
    for index, img in enumerate(images):
        strip.paste(img, (index * width, 0))
    for img in images:
        img.close()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(args.out)

    print("frame order:")
    for index, path in enumerate(frames):
        print(f"  {index}: {path.name}")
    print(f"\n{len(frames)} frames at {width}x{height} -> {args.out} ({strip.width}x{strip.height})")


if __name__ == "__main__":
    main()
