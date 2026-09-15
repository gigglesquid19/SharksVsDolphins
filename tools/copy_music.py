"""Copies the authored music into the public/music layout the game actually loads.

Source: audio/Menus, audio/Ambient/<zone folder>, audio/Boss - the project's convention for
original assets (see CREDITS.md).
Output: public/music/menu.mp3, public/music/ambient/zone<N>/<name>.mp3, public/music/boss/<name>.mp3

A straight copy, not a re-encode - see vite.config.ts, where music is cached at runtime rather
than precached at install specifically because it is large, so nothing here needs to fight that
budget. The mapping is hardcoded rather than discovered, because the served names it targets
(src/music.ts) are meant to read cleanly in a URL, and Pixabay's download filenames are not.

Usage: python tools/copy_music.py [--check]
  --check reports what is missing, without copying anything.
"""

import os
import shutil
import sys

SRC_ROOT = "audio"
OUT_ROOT = os.path.join("public", "music")

# (source path under SRC_ROOT, destination path under OUT_ROOT). The menu track and zone 1's
# first ambient track are deliberately the same source file - see MENU_TRACK in src/music.ts.
MAPPING = [
    (os.path.join("Menus", "alex-morgan-ocean-waves-chill-537452.mp3"), "menu.mp3"),
    (os.path.join("Ambient", "Level 1 - 9", "alex-morgan-ocean-waves-chill-537452.mp3"), os.path.join("ambient", "zone1", "ocean-waves-chill.mp3")),
    (os.path.join("Ambient", "Level 1 - 9", "andriicomposer-ocean-joy-380628.mp3"), os.path.join("ambient", "zone1", "ocean-joy.mp3")),
    (os.path.join("Ambient", "Level 1 - 9", "dupilupiworld-wonders-of-the-ocean-295598.mp3"), os.path.join("ambient", "zone1", "wonders-of-the-ocean.mp3")),
    (os.path.join("Ambient", "Level 1 - 9", "vadim_makes_sound-fantasy-worlds-enchanted-garden-570007.mp3"), os.path.join("ambient", "zone1", "enchanted-garden.mp3")),
    (os.path.join("Ambient", "Level 11 - 19", "nojisuma-at-the-bottom-of-the-sea-where-the-sun-never-reaches-112916.mp3"), os.path.join("ambient", "zone2", "at-the-bottom-of-the-sea.mp3")),
    (os.path.join("Ambient", "Level 11 - 19", "nojisuma-the-ocean-122252.mp3"), os.path.join("ambient", "zone2", "the-ocean.mp3")),
    (os.path.join("Ambient", "Level 11 - 19", "stylomanas-whispers-for-winners-coral-labyrinth-ocean-suspense-loop-366755.mp3"), os.path.join("ambient", "zone2", "coral-labyrinth.mp3")),
    (os.path.join("Ambient", "Level 21 - 29", "goldensoundlabs-emotional-160374.mp3"), os.path.join("ambient", "zone3", "emotional.mp3")),
    (os.path.join("Ambient", "Level 21 - 29", "leo_music_production-an-epic-adventures-464049.mp3"), os.path.join("ambient", "zone3", "epic-adventure.mp3")),
    (os.path.join("Ambient", "Level 21 - 29", "turning_pages-sea-of-ghosts-579004.mp3"), os.path.join("ambient", "zone3", "sea-of-ghosts.mp3")),
    (os.path.join("Boss", "lemonmusicstudio-mad-world-365968.mp3"), os.path.join("boss", "mad-world.mp3")),
    (os.path.join("Boss", "montogoronto-dark-fight-music-boss-142794.mp3"), os.path.join("boss", "dark-fight.mp3")),
    (os.path.join("Boss", "nickpanek-fast-battle-intense-8-bit-chiptune-instrumental-378777.mp3"), os.path.join("boss", "fast-battle.mp3")),
    (os.path.join("Boss", "nickpanek-multi-boss-fast-paced-8-bit-chiptune-358679.mp3"), os.path.join("boss", "multi-boss.mp3")),
]


def main() -> int:
    check_only = "--check" in sys.argv
    missing = []
    total = 0
    for src_rel, dst_rel in MAPPING:
        src = os.path.join(SRC_ROOT, src_rel)
        if not os.path.isfile(src):
            missing.append(src)
            continue
        total += os.path.getsize(src)

    if missing:
        print("MISSING source file(s):")
        for m in missing:
            print(f"  {m}")

    if check_only:
        print(f"{len(MAPPING) - len(missing)}/{len(MAPPING)} sources found, {total / 1024 / 1024:.1f} MB total.")
        return 1 if missing else 0

    if missing:
        return 1

    for src_rel, dst_rel in MAPPING:
        src = os.path.join(SRC_ROOT, src_rel)
        dst = os.path.join(OUT_ROOT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        size = shutil.copyfile(src, dst) and os.path.getsize(dst)
        print(f"{dst_rel:<40} <- {src_rel}  ({size / 1024:.0f} KB)")

    print(f"\n{len(MAPPING)} files, {total / 1024 / 1024:.1f} MB total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
