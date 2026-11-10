/** Radii for a board pellet: a slightly larger disc, a highlight, and a ring on the nearest food. */
export function foodRadii(cell: number, nearest: boolean): { fill: number; highlight: number; ring: number | null } {
  const fill = Math.max(nearest ? 3.2 : 2.7, cell * (nearest ? 0.32 : 0.26));
  return {
    fill,
    highlight: Math.max(0.9, fill * 0.35),
    ring: nearest ? Math.max(fill + 1.75, cell * 0.48) : null,
  };
}

/** Place the highlight toward the upper-left so the pellet reads as a solid piece. */
export function foodHighlightOffset(fill: number): { x: number; y: number } {
  const delta = fill * 0.28;
  return { x: -delta, y: -delta };
}

export function foodColors(nearest: boolean): { body: string; highlight: string } {
  return nearest
    ? { body: '#f2f2f2', highlight: '#ffffff' }
    : { body: '#d6d6d6', highlight: '#f0f0f0' };
}

export function minimapFoodRadius(scale: number, nearest: boolean): number {
  return Math.max(nearest ? 1.8 : 1.4, scale * (nearest ? 0.85 : 0.5));
}
