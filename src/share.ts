/**
 * Milestone sharing. Opens the OS share sheet (Web Share API) with a fallback to
 * copying the text to the clipboard. A real social-media post can't be detected,
 * so `shareMilestone` resolves `true` whenever the share sheet completes without
 * the user cancelling - the standard "share to unlock" contract.
 */

// TODO: swap for the Play Store listing URL once the app is published.
export const SHARE_URL = 'https://gigglesquid19.github.io/SharksVsDolphins/';

/** The skin granted the first time a player shares a milestone (see src/skins.ts). */
export const SHARE_REWARD_SKIN = 'voyager';

export type ShareKind = 'campaign' | 'endless50';

function messageFor(kind: ShareKind, dolphinName: string): string {
  return kind === 'campaign'
    ? `${dolphinName} just saved the ocean in Sharks vs Dolphins! 🐬🦈`
    : `${dolphinName} reached Level 50 in Sharks vs Dolphins Endless mode! 🌊🦈`;
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Shows the share sheet (or copies to clipboard). Returns `true` if the share
 * completed, `false` if the user cancelled or no share mechanism is available.
 */
export async function shareMilestone(kind: ShareKind, dolphinName: string): Promise<boolean> {
  const text = messageFor(kind, dolphinName);
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  if (nav?.share) {
    try {
      await nav.share({ title: 'Sharks vs Dolphins', text, url: SHARE_URL });
      return true;
    } catch (err) {
      if (isAbort(err)) return false;
      // fall through to the clipboard fallback for any other failure
    }
  }

  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(`${text} ${SHARE_URL}`);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
