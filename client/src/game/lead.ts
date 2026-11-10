export const LEAD_NOTICE_MS = 2500;

/** Taking first place only counts after a previous rank is known, and not when you are alone. */
export function tookTheLead(input: {
  previousRank: number | null;
  nextRank: number | null;
  fieldSize: number;
  alive: boolean;
}): boolean {
  if (!input.alive || input.fieldSize < 2 || input.nextRank !== 1 || input.previousRank === null) return false;
  return input.previousRank !== 1;
}

export function isLeading(input: { rank: number | null; fieldSize: number; alive: boolean }): boolean {
  return input.alive && input.rank === 1 && input.fieldSize >= 2;
}

export function leadCopy(): string {
  return '升到第 1 名';
}

export function leadingLabel(leading: boolean): string {
  return leading ? '领先' : '';
}
