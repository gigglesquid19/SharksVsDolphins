#!/usr/bin/env python3
"""Regenerate the Play Store graphics in store/ from Images/GameLogo.jpg.

  * icon-512.png       - 512x512 listing icon (full-bleed; Play masks corners)
  * feature-graphic.png - 1024x500 banner with a darkened left third for the title

Screenshots are captured on-device, not here - see store/screenshots/HOW-TO-CAPTURE.md.

Run from the repo root:  python tools/generate_store_assets.py
Needs a bold system font; falls back through a few common names.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Images" / "GameLogo.jpg"
OUT = ROOT / "store"
FRAME_INSET = 72  # strips GameLogo's white edge + rounded corners

FONT_CANDIDATES = [
    "C:/Windows/Fonts/ariblk.ttf",       # Arial Black
    "C:/Windows/Fonts/seguibl.ttf",      # Segoe UI Black
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Black.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main() -> None:
    OUT.mkdir(exist_ok=True)
    src = Image.open(SRC).convert("RGB")
    w, h = src.size
    art = src.crop((FRAME_INSET, FRAME_INSET, w - FRAME_INSET, h - FRAME_INSET))

    # --- 512 listing icon ---
    art.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")

    # --- 1024x500 feature graphic ---
    fw, fh = 1024, 500
    scale = max(fw / art.width, fh / art.height)
    cw, ch = int(art.width * scale), int(art.height * scale)
    cover = art.resize((cw, ch), Image.LANCZOS).crop(
        ((cw - fw) // 2, (ch - fh) // 2, (cw - fw) // 2 + fw, (ch - fh) // 2 + fh)
    )

    overlay = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for x in range(fw):
        a = int(238 * max(0.0, 1 - (x / (fw * 0.72)) ** 1.15))
        od.line([(x, 0), (x, fh)], fill=(2, 6, 23, a))
    graphic = Image.alpha_composite(cover.convert("RGBA"), overlay)

    text_layer = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)
    big, vs, tag = load_font(84), load_font(36), load_font(29)
    x0, y0 = 52, 140
    td.text((x0, y0), "SHARKS", font=big, fill=(234, 239, 246))
    td.text((x0, y0 + 86), "vs", font=vs, fill=(148, 163, 184))
    td.text((x0 + 66, y0 + 80), "DOLPHINS", font=big, fill=(56, 189, 248))
    td.text((x0 + 2, y0 + 188), "Survive the open ocean.", font=tag, fill=(206, 216, 228))
    shadow = text_layer.filter(ImageFilter.GaussianBlur(6))
    graphic = Image.alpha_composite(graphic, shadow)
    graphic = Image.alpha_composite(graphic, shadow)
    graphic = Image.alpha_composite(graphic, text_layer).convert("RGB")
    graphic.save(OUT / "feature-graphic.png")

    print(f"Wrote {OUT/'icon-512.png'} and {OUT/'feature-graphic.png'}")


if __name__ == "__main__":
    main()
