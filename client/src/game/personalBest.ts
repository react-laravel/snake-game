const STORAGE_KEY = 'snake_best_score';

export function readPersonalBest(): number {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === null) return 0;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/** Persists when the session score exceeds the stored best. Returns the new best. */
export function updatePersonalBest(score: number): number {
  const safe = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const previous = readPersonalBest();
  if (safe <= previous) return previous;
  try {
    localStorage.setItem(STORAGE_KEY, String(safe));
  } catch {
    // Storage disabled; in-memory play still works.
  }
  return safe;
}
