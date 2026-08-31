#!/usr/bin/env python3
"""Make the About Me photo from Images/AboutMe/AboutMe.jpeg.

Downscales to 720px wide and saves webp. Shown on the About screen
(#aboutScreen in index.html).

Run from the repo root:  python tools/generate_about_image.py

The photo is the project author's own - see CREDITS.md.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Images" / "AboutMe" / "AboutMe.jpeg"
OUT = ROOT / "public" / "about-me.webp"
WIDTH = 720


def main() -> None:
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    img = img.resize((WIDTH, round(h * WIDTH / w)), Image.LANCZOS)
    img.save(OUT, quality=82, method=6)
    print(f"wrote {OUT.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
