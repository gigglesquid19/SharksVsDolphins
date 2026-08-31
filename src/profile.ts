const KEY = 'svsd-dolphin-name';

export const DEFAULT_DOLPHIN_NAME = 'Echo';
export const MAX_DOLPHIN_NAME_LENGTH = 14;

/** Keep letters, digits, spaces and a few name-ish marks; drop everything else. */
function sanitize(raw: string): string {
  const cleaned = raw
    .replace(/[^\p{L}\p{N} '.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DOLPHIN_NAME_LENGTH)
    .trim();
  return cleaned || DEFAULT_DOLPHIN_NAME;
}

/** The player's dolphin name, or `Echo` if they have not set one. */
export function getDolphinName(): string {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(raw) : DEFAULT_DOLPHIN_NAME;
  } catch (e) {
    console.warn('Failed to read dolphin name', e);
    return DEFAULT_DOLPHIN_NAME;
  }
}

/** Whether the player has ever set a name (drives the first-run prompt). */
export function hasNamedDolphin(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch (e) {
    console.warn('Failed to read dolphin name', e);
    return false;
  }
}

/** Cleans and stores the name, returning the value actually saved. */
export function setDolphinName(raw: string): string {
  const name = sanitize(raw);
  try {
    localStorage.setItem(KEY, name);
  } catch (e) {
    console.warn('Failed to save dolphin name', e);
  }
  return name;
}
