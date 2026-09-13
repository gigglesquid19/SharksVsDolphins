/**
 * The arena, in world units.
 *
 * Portrait rather than square. A square arena can only ever be as tall as the screen is wide, so
 * on a phone half the screen was letterboxing that no layout could reclaim - the play area was
 * capped by the width whatever was done around it. Taller than wide, the water fills the shape a
 * phone actually is.
 *
 * The area is close to the square's (10,800 against 10,000), so a level holds about as many sharks
 * per square unit as it always did and the speeds, reaches and radii tuned against it still mean
 * what they meant. Only the shape has changed: the world wraps horizontally over 90 units instead
 * of 100, and there are 20 more units of water to swim up and down.
 */
export const SIZE_X = 90;
export const SIZE_Y = 120;

/** Pixels per world unit. Fixed, so the world is never drawn out of proportion. */
export const WORLD_SCALE = 6;

/** The rendered canvas, in pixels. */
export const CANVAS_W = SIZE_X * WORLD_SCALE;
export const CANVAS_H = SIZE_Y * WORLD_SCALE;
