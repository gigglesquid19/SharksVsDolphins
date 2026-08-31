#!/usr/bin/env python3
"""Extract the pearl currency icon from the Mischeal treasure pack into public/.

The pack `Treasure_pack_ores.png` is a 10x9 grid of 16x16 tiles. The pearl is
the white/cream sphere at column 9, row 0 -> pixel rect (144, 0, 16, 16).

Output: public/pearl.png (native 16x16, RGBA preserved). Shown pixel-crisp in
the UI via CSS `image-rendering: pixelated`.

Run from the repo root:  python tools/extract_pearl.py

License: the source pack is CC BY 4.0 by Mischeal - see CREDITS.md and
`Images/Treasure pack [16x16] by Mischeal/Read me.txt`.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Images" / "Treasure pack [16x16] by Mischeal" / "Treasure_pack_ores.png"
OUT = ROOT / "public" / "pearl.png"
TILE = 16
COL, ROW = 9, 0


def main() -> None:
    sheet = Image.open(SRC).convert("RGBA")
    x, y = COL * TILE, ROW * TILE
    pearl = sheet.crop((x, y, x + TILE, y + TILE))
    opaque = sum(1 for a in pearl.getchannel("A").tobytes() if a > 0)
    if opaque == 0:
        raise SystemExit("cropped tile is fully transparent - wrong COL/ROW?")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pearl.save(OUT)
    print(f"wrote {OUT.relative_to(ROOT)} ({opaque} non-transparent pixels)")


if __name__ == "__main__":
    main()
