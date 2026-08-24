import { beforeEach, describe, expect, it } from 'vitest';
import { hasSeenHint, markHintSeen } from './tutorialHints';

beforeEach(() => {
  localStorage.clear();
});

describe('hasSeenHint', () => {
  it('returns false when nothing has been marked seen', () => {
    expect(hasSeenHint('formPod')).toBe(false);
  });

  it('recovers gracefully from corrupted storage', () => {
    localStorage.setItem('svsd-tutorial-hints-seen', 'not json');
    expect(hasSeenHint('formPod')).toBe(false);
  });
});

describe('markHintSeen', () => {
  it('persists a hint as seen', () => {
    markHintSeen('formPod');
    expect(hasSeenHint('formPod')).toBe(true);
  });

  it('keeps hints independent of each other', () => {
    markHintSeen('formPod');
    expect(hasSeenHint('huntingMode')).toBe(false);
    expect(hasSeenHint('megaShrimp')).toBe(false);
  });

  it('accumulates multiple seen hints', () => {
    markHintSeen('formPod');
    markHintSeen('huntingMode');
    expect(hasSeenHint('formPod')).toBe(true);
    expect(hasSeenHint('huntingMode')).toBe(true);
    expect(hasSeenHint('megaShrimp')).toBe(false);
  });
});
