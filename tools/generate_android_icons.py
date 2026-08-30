#!/usr/bin/env python3
"""Regenerate the Android launcher icons from Images/GameLogo.jpg.

The source art is a single 1024x1024 illustration with a thin white edge and
rounded-corner frame. This script:

  * crops that frame off so the scene is full-bleed;
  * writes the legacy square/round PNGs (used on API 24-25) at every density;
  * writes the adaptive-icon (API 26+) layers: the whole scene goes in the
    *background* layer (blurred edge-extension fills the 108dp canvas, the sharp
    scene occupies the centre ~82dp so it survives the 66dp safe-zone mask); the
    *foreground* layer is transparent, because layering the same art at two
    scales just produces a ghost/double image.

Run from the repo root:  python tools/generate_android_icons.py
Then rebuild:            cd android && ./gradlew assembleDebug
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Images" / "GameLogo.jpg"
RES = ROOT / "android" / "app" / "src" / "main" / "res"

FRAME_INSET = 72          # px stripped off each edge of the 1024px source
ADAPTIVE_INNER = 0.82     # sharp scene as a fraction of the 108dp adaptive canvas

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
# Android 12+ splash icon: 288dp canvas, only the centre ~2/3 is unmasked, so the art
# is scaled to ~62% and centred on transparent. Rendered on @color/splashBackground.
SPLASH = {"mdpi": 288, "hdpi": 432, "xhdpi": 576, "xxhdpi": 864, "xxxhdpi": 1152}
SPLASH_INNER = 0.62


def circle_alpha(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    return mask


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    w, h = src.size
    art = src.crop((FRAME_INSET, FRAME_INSET, w - FRAME_INSET, h - FRAME_INSET))

    for name, px in LEGACY.items():
        folder = RES / f"mipmap-{name}"
        square = art.resize((px, px), Image.LANCZOS)
        square.save(folder / "ic_launcher.png")
        rnd = square.convert("RGBA")
        rnd.putalpha(circle_alpha(px))
        rnd.save(folder / "ic_launcher_round.png")

    for name, px in ADAPTIVE.items():
        folder = RES / f"mipmap-{name}"
        blurred = art.resize((px, px), Image.LANCZOS).filter(
            ImageFilter.GaussianBlur(radius=px * 0.06)
        )
        inner = int(px * ADAPTIVE_INNER)
        blurred.paste(art.resize((inner, inner), Image.LANCZOS),
                      ((px - inner) // 2, (px - inner) // 2))
        blurred.convert("RGBA").save(folder / "ic_launcher_background.png")
        Image.new("RGBA", (px, px), (0, 0, 0, 0)).save(folder / "ic_launcher_foreground.png")

    for name, px in SPLASH.items():
        folder = RES / f"drawable-{name}"
        folder.mkdir(exist_ok=True)
        canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        inner = int(px * SPLASH_INNER)
        rounded = art.resize((inner, inner), Image.LANCZOS).convert("RGBA")
        rounded.putalpha(circle_alpha(inner))
        canvas.paste(rounded, ((px - inner) // 2, (px - inner) // 2), rounded)
        canvas.save(folder / "splash_icon.png")

    print(f"Regenerated launcher + splash icons under {RES} from {SRC.name}")


if __name__ == "__main__":
    main()
