#!/usr/bin/env python3
"""Make the Store screen background from Images/StartMenuShop/Shop2.jpg.

Center-crops to a square and downscales to 900x900 webp. The screen itself
dims it further with a gradient overlay (see .store-screen in src/style.css).

Run from the repo root:  python tools/generate_shop_bg.py

License: Leonardo AI, same terms as the other Images/*.jpg - see CREDITS.md.
Shop1.jpg is kept as an unused alternate.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Images" / "StartMenuShop" / "Shop2.jpg"
OUT = ROOT / "public" / "shop-bg.webp"
SIZE = 900


def main() -> None:
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
    img.resize((SIZE, SIZE), Image.LANCZOS).save(OUT, quality=82, method=6)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
