#!/usr/bin/env python3
"""Make the splash-screen poster from Images/StartScreen/start-screen.png.

Converts to webp at native size. Shown full-bleed on the splash screen
(#splashScreen in index.html) - the title, the two characters and the
"Tap to Start" call to action are all painted into this single image, so it is
letterboxed rather than cropped and nothing is drawn on top of it.

Run from the repo root:  python tools/generate_splash_art.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Images" / "StartScreen" / "start-screen.png"
OUT = ROOT / "public" / "splash-art.webp"


def main() -> None:
    img = Image.open(SRC).convert("RGB")
    img.save(OUT, quality=84, method=6)
    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.relative_to(ROOT)} ({img.size[0]}x{img.size[1]}, {kb:.0f} KB)")


if __name__ == "__main__":
    main()
