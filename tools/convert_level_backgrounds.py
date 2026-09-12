"""Convert the authored Endless level art into the webp files the game loads.

Source: Images/Levels/<zone>/<level>.png|jpg, numbered 1-50 across five depth zones.
Output: public/levels/endless/<level>.webp

The game cover-scales each background over a 600px square canvas with a 1.14 overscan, so
anything past ~900px on the short side is thrown away. Quality 82 is well past the point where
these gradient-heavy ocean scenes show artefacts, and still lands them around 10-30 KB each -
small enough that they stay in the service worker's precache with the rest of the app.

Usage: python tools/convert_level_backgrounds.py [--check]
  --check reports what is missing and what would change, without writing anything.
"""

import os
import sys
from PIL import Image

SRC_ROOT = os.path.join("Images", "Levels")
OUT_DIR = os.path.join("public", "levels", "endless")
SHORT_SIDE = 900
QUALITY = 82
LAST_LEVEL = 50
# Folders whose numbers are the level numbers. Anything else under Images/Levels (spares,
# rejects, the Redo pile) is ignored.
ZONES = [
    "1. Eutrophic",
    "2. Mesopelagic",
    "3. Abyssopelagic",
    "4. Mythopelagic",
    "5. Hadal",
]


def find_sources() -> dict[int, str]:
    """Maps level number -> source file, from the numbered zone folders."""
    found: dict[int, str] = {}
    for zone in ZONES:
        zone_dir = os.path.join(SRC_ROOT, zone)
        if not os.path.isdir(zone_dir):
            continue
        for name in os.listdir(zone_dir):
            stem, ext = os.path.splitext(name)
            if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
                continue
            if not stem.isdigit():
                continue
            found[int(stem)] = os.path.join(zone_dir, name)
    return found


def convert(src: str, dst: str) -> int:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    scale = SHORT_SIDE / min(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    return os.path.getsize(dst)


def main() -> int:
    check_only = "--check" in sys.argv
    sources = find_sources()
    missing = [n for n in range(1, LAST_LEVEL + 1) if n not in sources]
    extra = sorted(n for n in sources if n > LAST_LEVEL)

    if missing:
        print(f"MISSING art for level(s): {', '.join(map(str, missing))}")
    if extra:
        print(f"Ignoring numbers past {LAST_LEVEL}: {extra}")
    if check_only:
        print(f"{len(sources)} source images found.")
        return 1 if missing else 0

    # A level with no art would load nothing and leave the player staring at a bare canvas, so
    # gaps are filled from the nearest level that does have art. The substitution is printed
    # every run rather than recorded anywhere, so it stays visible until the real art lands.
    for level in missing:
        nearest = min((n for n in sources if n <= LAST_LEVEL), key=lambda n: (abs(n - level), n))
        sources[level] = sources[nearest]
        print(f"  level {level}: standing in with level {nearest}'s art")

    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for level in sorted(n for n in sources if n <= LAST_LEVEL):
        dst = os.path.join(OUT_DIR, f"{level}.webp")
        size = convert(sources[level], dst)
        total += size
        print(f"{level:>3}  {os.path.basename(sources[level]):<12} -> {size / 1024:6.1f} KB")
    count = len([n for n in sources if n <= LAST_LEVEL])
    print(f"\n{count} backgrounds, {total / 1024 / 1024:.2f} MB total")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
