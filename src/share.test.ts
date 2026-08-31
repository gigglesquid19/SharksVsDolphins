import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHARE_URL, shareMilestone } from './share';

function setNav(prop: 'share' | 'clipboard', value: unknown): void {
  Object.defineProperty(navigator, prop, { value, configurable: true });
}
function clearNav(prop: 'share' | 'clipboard'): void {
  Object.defineProperty(navigator, prop, { value: undefined, configurable: true });
}

afterEach(() => {
  clearNav('share');
  clearNav('clipboard');
  vi.restoreAllMocks();
});

describe('shareMilestone', () => {
  it('resolves true when the share sheet completes', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNav('share', share);
    await expect(shareMilestone('campaign', 'Echo')).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: SHARE_URL, text: expect.stringContaining('Echo') }),
    );
  });

  it('resolves false when the user cancels the share sheet', async () => {
    setNav('share', vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')));
    await expect(shareMilestone('campaign', 'Echo')).resolves.toBe(false);
  });

  it('falls back to the clipboard when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNav('clipboard', { writeText });
    await expect(shareMilestone('endless50', 'Splash')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(SHARE_URL));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Level 50'));
  });

  it('falls back to the clipboard when Web Share throws a non-abort error', async () => {
    setNav('share', vi.fn().mockRejectedValue(new Error('not allowed')));
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNav('clipboard', { writeText });
    await expect(shareMilestone('campaign', 'Echo')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalled();
  });

  it('resolves false when nothing is available', async () => {
    await expect(shareMilestone('campaign', 'Echo')).resolves.toBe(false);
  });

  it('uses a different message for each milestone', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNav('share', share);
    await shareMilestone('campaign', 'Echo');
    await shareMilestone('endless50', 'Echo');
    const [campaignArg, endlessArg] = share.mock.calls.map((c) => c[0].text as string);
    expect(campaignArg).not.toBe(endlessArg);
    expect(campaignArg).toMatch(/saved the ocean/i);
    expect(endlessArg).toMatch(/level 50/i);
  });
});
