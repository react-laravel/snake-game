import type { Dir, SnakeSegment } from '../types/game';

/** Fraction of the visible span to shift the follow point forward. */
export const CAMERA_LEAD_FRACTION = 0.28;
/** Keep this many cells of trailing room so the head never leaves the view. */
export const CAMERA_LEAD_MARGIN = 2;

const STEP: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** How far, in cells, the camera may look ahead without pushing the head off-screen. */
export function cameraLeadCells(
  span: number,
  fraction = CAMERA_LEAD_FRACTION,
  margin = CAMERA_LEAD_MARGIN,
): number {
  const room = Math.max(0, Math.floor(span / 2) - margin);
  const desired = Math.round(Math.max(0, span - 1) * fraction);
  return Math.max(0, Math.min(room, desired));
}

/** Prefer the last queued turn so the view leans into the upcoming heading. */
export function cameraLeadDir(current: Dir | undefined, pending: Dir[] = []): Dir | undefined {
  return pending.length ? pending[pending.length - 1] : current;
}

/** Shift a follow point forward along the travel direction. */
export function cameraLeadFocus(
  head: SnakeSegment,
  dir: Dir | undefined,
  visible: { columns: number; rows: number },
): SnakeSegment {
  if (!dir) return head;
  const horizontal = dir === 'left' || dir === 'right';
  const ahead = cameraLeadCells(horizontal ? visible.columns : visible.rows);
  if (ahead <= 0) return head;
  const [dx, dy] = STEP[dir];
  return { x: head.x + dx * ahead, y: head.y + dy * ahead };
}
