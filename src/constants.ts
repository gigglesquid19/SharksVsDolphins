/**
 * The arena, in world units.
 *
 * Portrait rather than square. A square arena can only ever be as tall as the screen is wide, so
 * on a phone half the screen was letterboxing that no layout could reclaim - the play area was
 * capped by the width whatever was done around it. Taller than wide, the water fills the shape a
 * phone actually is.
 *
 * Taller again, now, because 3:4 was still not the shape of a phone. On a 393x852 screen the
 * canvas can only be as wide as the panel allows - 348px - and at 3:4 that fixed its height at
 * 464px whatever the stylesheet's height budget said, so the budget never bound and adjusting it
 * did nothing. At 79:137 the same 348px of width buys 603px of height, which is the 30% the play
 * area was short.
 *
 * The area is held where it was (10,823 against 10,800), which is the same bargain the move off
 * the square made: a level holds as many sharks per square unit as it did, so the speeds, reaches
 * and radii tuned against it still mean what they meant. The width pays for the height - the
 * world now wraps horizontally over 79 units rather than 90, so a lap across the screen is a
 * little shorter and there are 17 more units of water to swim up and down.
 */
export const SIZE_X = 79;
export const SIZE_Y = 137;

/** Pixels per world unit. Fixed, so the world is never drawn out of proportion. */
export const WORLD_SCALE = 6;

/** The rendered canvas, in pixels. */
export const CANVAS_W = SIZE_X * WORLD_SCALE;
export const CANVAS_H = SIZE_Y * WORLD_SCALE;
