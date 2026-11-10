import type { Dir, Player, SnakeSegment } from '../types/game';

const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export type ThreatKind = 'wall' | 'snake' | 'head-on';

export interface ImmediateThreat {
  kind: ThreatKind;
  distance: 1 | 2;
  x: number;
  y: number;
  /** In-bounds cell to outline. A wall just outside the board has no mark. */
  mark: SnakeSegment | null;
}

function cellKey(cell: SnakeSegment) {
  return `${cell.x},${cell.y}`;
}

/** Cells that will still be occupied after this tick. A moving snake's tail vacates. */
export function solidCells(players: Player[]) {
  const cells = new Set<string>();
  for (const player of players) {
    if (!player.alive || player.snake.length === 0) continue;
    const staying = player.frozen ? player.snake : player.snake.slice(0, -1);
    for (const segment of staying) cells.add(cellKey(segment));
  }
  return cells;
}

function outside(cell: SnakeSegment, grid: { w: number; h: number }) {
  return cell.x < 0 || cell.y < 0 || cell.x >= grid.w || cell.y >= grid.h;
}

function advance(cell: SnakeSegment, dir: Dir) {
  const [dx, dy] = STEP[dir];
  return { x: cell.x + dx, y: cell.y + dy };
}

function sameCell(a: SnakeSegment, b: SnakeSegment) {
  return a.x === b.x && a.y === b.y;
}

/** Where a moving snake's head will be next tick. Queued turns of other players are unknown. */
function plannedHead(player: Player) {
  const head = player.snake[0];
  if (!player.alive || player.frozen || !player.dir || !head) return null;
  return advance(head, player.dir);
}

function headOn(players: Player[], selfId: string, head: SnakeSegment, next: SnakeSegment): ImmediateThreat | null {
  for (const other of players) {
    if (other.id === selfId) continue;
    const incoming = plannedHead(other);
    const theirHead = other.snake[0];
    if (!incoming || !theirHead) continue;
    const meet = sameCell(incoming, next);
    const swap = sameCell(incoming, head) && sameCell(next, theirHead);
    if (meet || swap) return { kind: 'head-on', distance: 1, x: next.x, y: next.y, mark: next };
  }
  return null;
}

export function immediateThreat(
  players: Player[],
  playerId: string | null,
  pendingDirs: Dir[] | undefined,
  grid: { w: number; h: number },
): ImmediateThreat | null {
  const self = players.find((player) => player.id === playerId);
  if (!self?.alive || self.frozen) return null;
  const head = self.snake[0];
  const first = pendingDirs?.[0] ?? self.dir;
  if (!head || !first) return null;
  const next = advance(head, first);
  if (outside(next, grid)) return { kind: 'wall', distance: 1, ...next, mark: null };
  const crossing = headOn(players, self.id, head, next);
  if (crossing) return crossing;
  if (solidCells(players).has(cellKey(next))) return { kind: 'snake', distance: 1, ...next, mark: next };
  const second = pendingDirs?.[1] ?? first;
  const after = advance(next, second);
  if (outside(after, grid)) return { kind: 'wall', distance: 2, ...after, mark: next };
  return null;
}
