/** How many segments, counting from the tail, shrink toward the tip. */
export const TAPER_SEGMENTS = 8;
/** Tail width as a fraction of the full body, so the tip stays visible. */
export const TAPER_MIN_RATIO = 0.5;

/**
 * Width of a body segment. Index 0 is the head (full width); the last
 * `TAPER_SEGMENTS` segments ease down to `TAPER_MIN_RATIO` at the tail.
 */
export function bodyTaper(
  index: number,
  length: number,
  maxWidth: number,
  tail = TAPER_SEGMENTS,
  minRatio = TAPER_MIN_RATIO,
): number {
  if (maxWidth <= 0 || length <= 0) return 0;
  if (length === 1 || index <= 0) return maxWidth;
  const tip = Math.max(1, Math.min(tail, length - 1));
  const fromTail = length - 1 - index;
  if (fromTail >= tip) return maxWidth;
  const t = fromTail / tip;
  return maxWidth * (minRatio + (1 - minRatio) * t);
}
