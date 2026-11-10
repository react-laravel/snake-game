import type { Dir, GridSize, SnakeSegment } from '../types/game';

const VECTORS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Matches the server's preferred open lead of eight ticks at 150ms. */
export const RUNWAY_STEPS = 8;
export const RUNWAY_MS = 1200;

export function snakeBlockKeys(players: Array<{ alive: boolean; snake: SnakeSegment[] }>): Set<string> {
  const blocked = new Set<string>();
  for (const player of players) {
    if (!player.alive) continue;
    for (const segment of player.snake) blocked.add(`${segment.x},${segment.y}`);
  }
  return blocked;
}

/**
 * Clear cells ahead of a newly spawned snake, matching the server runway:
 * walls and other (or own) snake bodies stop the lead; food does not.
 */
export function spawnRunway(
  head: SnakeSegment | null | undefined,
  dir: Dir | undefined,
  grid: GridSize,
  blocked: Set<string>,
  maxSteps = RUNWAY_STEPS,
): SnakeSegment[] {
  if (!head || !dir || maxSteps <= 0) return [];
  const [dx, dy] = VECTORS[dir];
  const cells: SnakeSegment[] = [];
  for (let step = 1; step <= maxSteps; step++) {
    const cell = { x: head.x + dx * step, y: head.y + dy * step };
    if (cell.x < 0 || cell.y < 0 || cell.x >= grid.w || cell.y >= grid.h) break;
    if (blocked.has(`${cell.x},${cell.y}`)) break;
    cells.push(cell);
  }
  return cells;
}

/** Start the hint when a snake becomes alive; clear it on death. */
export function rememberSpawnHint(
  previousAlive: boolean,
  nextAlive: boolean,
  nowMs: number,
  startedAt: number | null,
): number | null {
  if (!nextAlive) return null;
  if (!previousAlive) return nowMs;
  return startedAt;
}

export function shouldShowSpawnRunway(input: {
  alive: boolean;
  startedAt: number | null;
  nowMs: number;
  durationMs?: number;
}): boolean {
  if (!input.alive || input.startedAt === null) return false;
  const elapsed = input.nowMs - input.startedAt;
  return elapsed >= 0 && elapsed < (input.durationMs ?? RUNWAY_MS);
}

export function runwayHintCopy(steps: number): string | null {
  return steps > 0 ? `前方 ${steps} 格开阔` : null;
}
