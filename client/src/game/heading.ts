import type { Dir } from '../types/game';

/** Long enough to read, and independent of the shorter spawn-runway window. */
export const HEADING_MS = 2000;

const DIR_COPY: Record<Dir, string> = {
  up: '向上出发',
  down: '向下出发',
  left: '向左出发',
  right: '向右出发',
};

const DIRS = new Set<string>(['up', 'down', 'left', 'right']);

export type HeadingStart = { startedAt: number; dir: Dir };

export function parseHeadingDir(dir: string | null | undefined): Dir | null {
  return dir && DIRS.has(dir) ? (dir as Dir) : null;
}

export function headingCopy(dir: Dir): string {
  return `${DIR_COPY[dir]} · 现在就能转向`;
}

/**
 * Start a heading notice on the first time we see ourselves alive (join) and
 * on each later death-to-life transition (respawn). Keep the spawn direction
 * even if the player turns. A missing snapshot should be ignored by the caller
 * so a reconnect gap does not look like a respawn.
 */
export function nextHeadingStart(input: {
  hasSeenSelf: boolean;
  wasAlive: boolean;
  alive: boolean;
  dir: string | null | undefined;
  start: HeadingStart | null;
  nowMs: number;
}): { hasSeenSelf: boolean; start: HeadingStart | null } {
  if (!input.alive) return { hasSeenSelf: true, start: null };
  const fresh = !input.hasSeenSelf || !input.wasAlive;
  if (!fresh) return { hasSeenSelf: true, start: input.start };
  const dir = parseHeadingDir(input.dir);
  return { hasSeenSelf: true, start: dir ? { startedAt: input.nowMs, dir } : null };
}

export function headingNotice(start: HeadingStart | null, nowMs: number): string | null {
  if (!start) return null;
  const elapsed = nowMs - start.startedAt;
  if (elapsed < 0 || elapsed >= HEADING_MS) return null;
  return headingCopy(start.dir);
}
