#!/usr/bin/env python3
"""Regenerate the PWA / favicon images in public/ from Images/GameLogo.jpg.

  * icon-192.png / icon-512.png  - full-bleed (purpose "any"); also the browser-tab favicon
  * icon-maskable-512.png        - purpose "maskable": the scene sits in the centre ~80%
                                   with a blurred edge extension, so a launcher mask
                                   (circle / squircle) never clips the animals
  * game-logo.webp              - the frame-stripped art at display resolution, shown on
                                   the in-app splash screen (see #splashScreen in index.html)

Run from the repo root:  python tools/generate_web_icons.py
Then rebuild (npm run build / build:android) and redeploy.
"""
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Images" / "GameLogo.jpg"
OUT = ROOT / "public"
FRAME_INSET = 72          # strips GameLogo's white edge + rounded corners
MASKABLE_INNER = 0.80     # sharp scene as a fraction of the maskable canvas


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    w, h = src.size
    art = src.crop((FRAME_INSET, FRAME_INSET, w - FRAME_INSET, h - FRAME_INSET))

    for size in (192, 512):
        art.resize((size, size), Image.LANCZOS).convert("RGBA").save(OUT / f"icon-{size}.png")

    px = 512
    blurred = art.resize((px, px), Image.LANCZOS).filter(ImageFilter.GaussianBlur(px * 0.06))
    inner = int(px * MASKABLE_INNER)
    blurred.paste(art.resize((inner, inner), Image.LANCZOS), ((px - inner) // 2, (px - inner) // 2))
    blurred.convert("RGBA").save(OUT / "icon-maskable-512.png")

    # Splash art: the frame-stripped scene at ~2x its on-screen size, as webp.
    art.resize((640, 640), Image.LANCZOS).save(OUT / "game-logo.webp", quality=82, method=6)

    print(f"Wrote icon-192.png, icon-512.png, icon-maskable-512.png, game-logo.webp to {OUT}")


if __name__ == "__main__":
    main()
