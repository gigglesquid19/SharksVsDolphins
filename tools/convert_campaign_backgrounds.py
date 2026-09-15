"""Convert the authored Campaign level art into the webp files the game loads.

Source: Images/Levels/Campaign/<level>.png|jpg, numbered 1-10.
Output: public/levels/<level>.webp

Campaign and Depthless levels 1-10 are deliberately different art, not shared - see
convert_level_backgrounds.py for the Depthless/Endless side (Images/Levels/<zone>/<level>.png,
output under public/levels/endless/). Same scale and quality as that script, so the two sets
read as one visual family: the game cover-scales each background over a 600px square canvas
with a 1.14 overscan, so anything past ~900px on the short side is thrown away, and quality 82
is well past the point these gradient-heavy ocean scenes show artefacts.

Usage: python tools/convert_campaign_backgrounds.py [--check]
  --check reports what is missing and what would change, without writing anything.
"""

import os
import sys
from PIL import Image

SRC_DIR = os.path.join("Images", "Levels", "Campaign")
OUT_DIR = os.path.join("public", "levels")
SHORT_SIDE = 900
QUALITY = 82
LAST_LEVEL = 10


def find_sources() -> dict[int, str]:
    """Maps level number -> source file, from the numbered files in SRC_DIR.

    A stem is either a bare level number ("3.png") or a level number with a ".1" suffix
    ("3.1.png") - the second form wins only when the bare form is absent, so the folder can
    hold both an in-use image and a spare/revision without the spare silently overwriting it.
    """
    found: dict[int, str] = {}
    fallback: dict[int, str] = {}
    if not os.path.isdir(SRC_DIR):
        return found
    for name in sorted(os.listdir(SRC_DIR)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        path = os.path.join(SRC_DIR, name)
        if stem.isdigit():
            found[int(stem)] = path
        elif stem.endswith(".1") and stem[:-2].isdigit():
            fallback[int(stem[:-2])] = path
    for level, path in fallback.items():
        found.setdefault(level, path)
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

    if missing:
        # A level with no art would load nothing and leave the player staring at a bare canvas,
        # so gaps are filled from the nearest level that does have art. Printed every run rather
        # than recorded anywhere, so it stays visible until the real art lands.
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
