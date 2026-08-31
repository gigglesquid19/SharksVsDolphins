const KEY = 'svsd-lifetime';

/** Cumulative totals across every run, for lifetime achievements (and, later, a stats screen). */
export interface LifetimeStats {
  dolphinsSaved: number;
  sharksKilled: number;
  playSeconds: number;
  /** Distinct calendar days the player has played, as `YYYY-MM-DD` strings. */
  playDays: string[];
}

type CounterKey = 'dolphinsSaved' | 'sharksKilled' | 'playSeconds';

function empty(): LifetimeStats {
  return { dolphinsSaved: 0, sharksKilled: 0, playSeconds: 0, playDays: [] };
}

function load(): LifetimeStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<LifetimeStats>;
    return {
      dolphinsSaved: Number(parsed.dolphinsSaved) || 0,
      sharksKilled: Number(parsed.sharksKilled) || 0,
      playSeconds: Number(parsed.playSeconds) || 0,
      playDays: Array.isArray(parsed.playDays) ? parsed.playDays.filter((d) => typeof d === 'string') : [],
    };
  } catch (e) {
    console.warn('Failed to load lifetime stats', e);
    return empty();
  }
}

function save(stats: LifetimeStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('Failed to save lifetime stats', e);
  }
}

/** Adds `by` to a running total and returns the new value, so callers can check thresholds inline. */
export function bumpLifetime(key: CounterKey, by: number): number {
  const stats = load();
  stats[key] += by;
  save(stats);
  return stats[key];
}

function todayKey(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Records that the player played today (deduped) and returns the distinct-day count. */
export function recordPlayDay(): number {
  const stats = load();
  const today = todayKey();
  if (!stats.playDays.includes(today)) {
    stats.playDays.push(today);
    save(stats);
  }
  return stats.playDays.length;
}

export function getLifetimeStats(): LifetimeStats {
  return load();
}
