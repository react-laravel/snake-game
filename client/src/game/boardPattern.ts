/** Darker and lighter board fills, kept close to the previous flat #252525. */
export const CELL_DARK = '#232323';
export const CELL_LIGHT = '#292929';

/** World-space checker parity, so the pattern does not crawl when the camera pans. */
export function cellParity(x: number, y: number): 0 | 1 {
  return ((Math.floor(x) + Math.floor(y)) & 1) as 0 | 1;
}

export function cellFill(x: number, y: number, dark = CELL_DARK, light = CELL_LIGHT): string {
  return cellParity(x, y) === 0 ? dark : light;
}

/** Inclusive-start, exclusive-end integer cells that overlap a (possibly fractional) view. */
export function visibleBoardCells(view: { x: number; y: number; columns: number; rows: number }) {
  return {
    startX: Math.floor(view.x),
    startY: Math.floor(view.y),
    endX: Math.ceil(view.x + view.columns),
    endY: Math.ceil(view.y + view.rows),
  };
}
