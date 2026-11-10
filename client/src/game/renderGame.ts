import type { Dir, GameState, GridSize, SnakeSegment } from '../types/game';

interface Viewport { cell: number; x: number; y: number; columns: number; rows: number; offsetX: number; offsetY: number; cropped: boolean; }
export interface RenderCache { background: HTMLCanvasElement | null; backgroundKey: string; head: SnakeSegment | null; }
interface RenderGameOptions { context: CanvasRenderingContext2D; width: number; height: number; dpr: number; cache: RenderCache; gameState: GameState | null; playerId: string | null; gridSize: GridSize; motionBlend?: number; pendingDirs?: Dir[]; threat?: { x: number; y: number; mark?: { x: number; y: number } | null } | null; longestId?: string | null; }

const MOTION_BACKTRACK: Record<Dir, [number, number]> = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };

/** Pixel offset so snakes slide between authoritative server ticks instead of jumping. */
export function getSnakeMotionShift(dir: Dir | undefined, cell: number, motionBlend: number): { dx: number; dy: number } {
  if (!dir || motionBlend >= 1) return { dx: 0, dy: 0 };
  const [ox, oy] = MOTION_BACKTRACK[dir];
  const amount = (1 - motionBlend) * cell;
  return { dx: ox * amount, dy: oy * amount };
}

/** Grid-space head position for a smoother follow camera between ticks. */
export function getCameraHead(head: SnakeSegment, dir: Dir | undefined, motionBlend: number): SnakeSegment {
  if (!dir || motionBlend >= 1) return head;
  const [ox, oy] = MOTION_BACKTRACK[dir];
  const back = 1 - motionBlend;
  return { x: head.x + ox * back, y: head.y + oy * back };
}

export function getViewport(width: number, height: number, grid: GridSize, head: SnakeSegment | null): Viewport {
  const padding = width < 600 ? 12 : 24;
  const cell = Math.max(8, Math.min((width - padding * 2) / grid.w, (height - padding * 2) / grid.h));
  // A mathematically exact full-board fit can round to 59.99999999999999.
  const columns = Math.min(grid.w, Math.max(1, Math.floor((width - padding * 2) / cell + 1e-8)));
  const rows = Math.min(grid.h, Math.max(1, Math.floor((height - padding * 2) / cell + 1e-8)));
  return {
    cell, columns, rows,
    x: Math.max(0, Math.min((head?.x ?? grid.w / 2) - Math.floor(columns / 2), grid.w - columns)),
    y: Math.max(0, Math.min((head?.y ?? grid.h / 2) - Math.floor(rows / 2), grid.h - rows)),
    offsetX: (width - columns * cell) / 2,
    offsetY: (height - rows * cell) / 2,
    cropped: columns < grid.w || rows < grid.h,
  };
}

export function minimapFrame(width: number, height: number, gridWidth: number, gridHeight: number) {
  const scale = Math.min(1.8, (width * 0.28) / gridWidth);
  const mapWidth = gridWidth * scale;
  const mapHeight = gridHeight * scale;
  const mapLeft = width - mapWidth - 16;
  const mapTop = height - mapHeight - 16;
  return { scale, mapWidth, mapHeight, mapLeft, mapTop, left: mapLeft - 5, top: mapTop - 5, width: mapWidth + 10, height: mapHeight + 10 };
}

/** Slide a marker to the nearest side of a rectangle so it stays readable. */
export function placeClearOf(x: number, y: number, rect: { left: number; top: number; width: number; height: number }, pad = 16) {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  if (x < rect.left - pad || x > right + pad || y < rect.top - pad || y > bottom + pad) return { x, y };
  const fromLeft = x - (rect.left - pad);
  const fromTop = y - (rect.top - pad);
  return fromLeft <= fromTop ? { x: rect.left - pad, y } : { x, y: rect.top - pad };
}

export function nearestFood(head: SnakeSegment, foods: SnakeSegment[]) {
  let best: { x: number; y: number; distance: number } | null = null;
  for (const food of foods) {
    const distance = Math.abs(food.x - head.x) + Math.abs(food.y - head.y);
    if (!best || distance < best.distance) best = { x: food.x, y: food.y, distance };
  }
  return best;
}

/** Closest living opponent head. Equal distances keep the earlier player. */
export function nearestOpponent(selfId: string | null, head: SnakeSegment, players: Array<{ id: string; alive: boolean; snake: SnakeSegment[] }>) {
  let best: { x: number; y: number; distance: number } | null = null;
  for (const player of players) {
    const other = player.snake[0];
    if (player.id === selfId || !player.alive || !other) continue;
    const distance = Math.abs(other.x - head.x) + Math.abs(other.y - head.y);
    if (!best || distance < best.distance) best = { x: other.x, y: other.y, distance };
  }
  return best;
}

/** Push a second marker off the first when they would overlap. */
export function separateMarkers(primary: SnakeSegment, secondary: SnakeSegment, gap = 18) {
  const dx = secondary.x - primary.x;
  const dy = secondary.y - primary.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= gap) return { x: secondary.x, y: secondary.y };
  if (distance < 0.001) return { x: secondary.x + gap, y: secondary.y };
  const scale = gap / distance;
  return { x: primary.x + dx * scale, y: primary.y + dy * scale };
}

export const NAME_RANGE = 12;

/** Your own name always stays. Other names appear only when their head is close. */
export function shouldShowSnakeName(self: boolean, selfHead: SnakeSegment | null, otherHead: SnakeSegment) {
  if (self || !selfHead) return true;
  return Math.abs(selfHead.x - otherHead.x) + Math.abs(selfHead.y - otherHead.y) <= NAME_RANGE;
}

/** Where an off-screen food meets the visible board, plus the direction toward it. */
export function foodPointer(view: Pick<Viewport, 'x' | 'y' | 'columns' | 'rows'>, food: SnakeSegment) {
  if (food.x >= view.x && food.x < view.x + view.columns && food.y >= view.y && food.y < view.y + view.rows) return null;
  const centerX = view.x + view.columns / 2;
  const centerY = view.y + view.rows / 2;
  const dx = food.x + 0.5 - centerX;
  const dy = food.y + 0.5 - centerY;
  const scaleX = dx === 0 ? Infinity : ((dx > 0 ? view.x + view.columns : view.x) - centerX) / dx;
  const scaleY = dy === 0 ? Infinity : ((dy > 0 ? view.y + view.rows : view.y) - centerY) / dy;
  const scale = Math.min(scaleX, scaleY);
  return { x: centerX + dx * scale, y: centerY + dy * scale, dx, dy };
}

function drawBackground(context: CanvasRenderingContext2D, width: number, height: number, grid: GridSize, view: Viewport) {
  const { cell, columns, rows, offsetX, offsetY, x, y } = view;
  context.fillStyle = '#202020';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#252525';
  context.fillRect(offsetX, offsetY, columns * cell, rows * cell);
  context.beginPath();
  for (let column = 0; column <= columns; column++) { context.moveTo(offsetX + column * cell, offsetY); context.lineTo(offsetX + column * cell, offsetY + rows * cell); }
  for (let row = 0; row <= rows; row++) { context.moveTo(offsetX, offsetY + row * cell); context.lineTo(offsetX + columns * cell, offsetY + row * cell); }
  context.strokeStyle = '#303030';
  context.lineWidth = 0.5;
  context.stroke();
  context.save();
  context.beginPath(); context.rect(offsetX - 2, offsetY - 2, columns * cell + 4, rows * cell + 4); context.clip();
  context.strokeStyle = '#909090'; context.lineWidth = 2;
  context.strokeRect(offsetX - x * cell, offsetY - y * cell, grid.w * cell, grid.h * cell);
  context.restore();
}

function drawMinimap(context: CanvasRenderingContext2D, width: number, height: number, grid: GridSize, view: Viewport, state: GameState, playerId: string | null, longestId: string | null) {
  const frame = minimapFrame(width, height, grid.w, grid.h);
  const { scale, mapWidth, mapHeight, mapLeft: left, mapTop: top } = frame;
  context.fillStyle = 'rgba(18,18,18,0.92)'; context.fillRect(left - 5, top - 5, mapWidth + 10, mapHeight + 10);
  context.strokeStyle = '#666'; context.lineWidth = 1; context.strokeRect(left, top, mapWidth, mapHeight);
  context.fillStyle = 'rgba(255,255,255,0.08)'; context.fillRect(left + view.x * scale, top + view.y * scale, view.columns * scale, view.rows * scale);
  context.strokeStyle = '#999'; context.strokeRect(left + view.x * scale, top + view.y * scale, view.columns * scale, view.rows * scale);
  context.fillStyle = '#dadada';
  const self = state.players.find((player) => player.id === playerId);
  const target = self?.alive && self.snake[0] ? nearestFood(self.snake[0], state.foods) : null;
  for (const food of state.foods) {
    const nearest = target?.x === food.x && target.y === food.y;
    context.beginPath();
    context.arc(left + (food.x + 0.5) * scale, top + (food.y + 0.5) * scale, Math.max(1.2, scale * (nearest ? 0.7 : 0.35)), 0, Math.PI * 2);
    context.fill();
    if (!nearest) continue;
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    context.stroke();
  }
  for (const player of state.players) {
    if (!player.alive) continue;
    context.globalAlpha = player.frozen ? 0.45 : 1;
    context.fillStyle = player.id === playerId ? '#fff' : player.color;
    for (const segment of player.snake) context.fillRect(left + segment.x * scale, top + segment.y * scale, Math.max(2, scale), Math.max(2, scale));
    if (player.id !== longestId || !player.snake[0]) continue;
    const tip = player.snake[0];
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    context.strokeRect(left + tip.x * scale - 1, top + tip.y * scale - 1, Math.max(2, scale) + 2, Math.max(2, scale) + 2);
  }
  context.globalAlpha = 1;
}

function drawEdgeFades(context: CanvasRenderingContext2D, grid: GridSize, view: Viewport) {
  const { cell, columns, rows, offsetX, offsetY, x, y } = view;
  const depth = Math.min(28, cell * 1.8);
  const boardWidth = columns * cell;
  const boardHeight = rows * cell;
  const fade = (horizontal: boolean, atEnd: boolean) => {
    const start = horizontal ? (atEnd ? offsetX + boardWidth - depth : offsetX) : (atEnd ? offsetY + boardHeight - depth : offsetY);
    const gradient = horizontal
      ? context.createLinearGradient(start, 0, start + depth, 0)
      : context.createLinearGradient(0, start, 0, start + depth);
    const solid = 'rgba(0,0,0,0.42)';
    gradient.addColorStop(atEnd ? 1 : 0, solid);
    gradient.addColorStop(atEnd ? 0 : 1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(horizontal ? start : offsetX, horizontal ? offsetY : start, horizontal ? depth : boardWidth, horizontal ? boardHeight : depth);
  };
  context.save();
  if (x > 0) fade(true, false);
  if (y > 0) fade(false, false);
  if (x + columns < grid.w) fade(true, true);
  if (y + rows < grid.h) fade(false, true);
  context.restore();
}

const QUEUE_GLYPH: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };

export function renderGame({ context, width, height, dpr, cache, gameState, playerId, gridSize, motionBlend = 1, pendingDirs = [], threat = null, longestId = null }: RenderGameOptions) {
  const currentPlayer = gameState?.players.find((player) => player.id === playerId);
  const head = currentPlayer?.snake[0];
  if (head) cache.head = head;
  const cameraHead = head && currentPlayer?.dir && motionBlend < 1
    ? getCameraHead(head, currentPlayer.dir, motionBlend)
    : head ?? cache.head;
  const view = getViewport(width, height, gridSize, cameraHead);
  const { cell, x, y, columns, rows, offsetX, offsetY } = view;
  const key = `${width}:${height}:${dpr}:${gridSize.w}:${gridSize.h}:${x}:${y}`;
  if (!cache.background) cache.background = document.createElement('canvas');
  if (cache.backgroundKey !== key) {
    cache.background.width = Math.round(width * dpr); cache.background.height = Math.round(height * dpr);
    const backgroundContext = cache.background.getContext('2d');
    if (backgroundContext) { backgroundContext.setTransform(dpr, 0, 0, dpr, 0, 0); drawBackground(backgroundContext, width, height, gridSize, view); }
    cache.backgroundKey = key;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.drawImage(cache.background, 0, 0, width, height);
  if (!gameState) {
    context.fillStyle = '#aaa'; context.textAlign = 'center'; context.font = '14px sans-serif'; context.fillText('正在准备竞技场…', width / 2, height / 2);
    return;
  }
  context.save(); context.beginPath(); context.rect(offsetX, offsetY, columns * cell, rows * cell); context.clip();
  const targetFood = currentPlayer?.alive && currentPlayer.snake[0] ? nearestFood(currentPlayer.snake[0], gameState.foods) : null;
  for (const food of gameState.foods) {
    const fx = food.x - x, fy = food.y - y;
    if (fx < 0 || fx >= columns || fy < 0 || fy >= rows) continue;
    const nearest = targetFood?.x === food.x && targetFood.y === food.y;
    context.fillStyle = nearest ? '#fff' : '#dadada';
    context.beginPath();
    context.arc(offsetX + (fx + 0.5) * cell, offsetY + (fy + 0.5) * cell, Math.max(2, cell * (nearest ? 0.28 : 0.22)), 0, Math.PI * 2);
    context.fill();
    if (!nearest) continue;
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(offsetX + (fx + 0.5) * cell, offsetY + (fy + 0.5) * cell, Math.max(4, cell * 0.42), 0, Math.PI * 2);
    context.stroke();
  }
  for (const player of gameState.players) {
    if (!player.alive || !player.snake.length) continue;
    const self = player.id === playerId;
    const shift = player.frozen ? { dx: 0, dy: 0 } : getSnakeMotionShift(player.dir, cell, motionBlend);
    context.save();
    if (player.frozen) context.globalAlpha = 0.45;
    context.strokeStyle = self ? '#f5f5f5' : player.color;
    context.fillStyle = context.strokeStyle;
    context.lineWidth = Math.max(4, cell - 3);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    let drawing = false;
    let headLeft = 0;
    let headTop = 0;
    let headCellX = 0;
    for (let i = player.snake.length - 1; i >= 0; i--) {
      const sx = player.snake[i].x - x, sy = player.snake[i].y - y;
      const onScreen = sx >= -1 && sx <= columns && sy >= -1 && sy <= rows;
      const cx = offsetX + (sx + 0.5) * cell + shift.dx;
      const cy = offsetY + (sy + 0.5) * cell + shift.dy;
      if (!onScreen) {
        if (drawing) context.stroke();
        context.beginPath();
        drawing = false;
        continue;
      }
      if (!drawing) context.moveTo(cx, cy);
      else context.lineTo(cx, cy);
      drawing = true;
      if (i !== 0) continue;
      headLeft = offsetX + sx * cell + shift.dx;
      headTop = offsetY + sy * cell + shift.dy;
      headCellX = sy;
    }
    if (drawing) {
      context.stroke();
      if (player.snake.length === 1) {
        context.beginPath();
        context.arc(headLeft + cell / 2, headTop + cell / 2, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill();
      }
    }
    const head = player.snake[0];
    const headVisible = head.x >= x && head.x < x + columns && head.y >= y && head.y < y + rows;
    if (headVisible) {
      if (self || player.id === longestId) { context.strokeStyle = '#fff'; context.lineWidth = 1.5; context.beginPath(); context.arc(headLeft + cell / 2, headTop + cell / 2, Math.max(5, cell * 0.42), 0, Math.PI * 2); context.stroke(); }
      const dir = player.dir ?? 'right';
      const points = dir === 'up' ? [[0.3, 0.28], [0.7, 0.28]] : dir === 'down' ? [[0.3, 0.72], [0.7, 0.72]] : dir === 'left' ? [[0.28, 0.3], [0.28, 0.7]] : [[0.72, 0.3], [0.72, 0.7]];
      context.fillStyle = '#161616';
      for (const [ex, ey] of points) { context.beginPath(); context.arc(headLeft + ex * cell, headTop + ey * cell, Math.max(1.2, cell * 0.08), 0, Math.PI * 2); context.fill(); }
      const selfHead = currentPlayer?.alive ? currentPlayer.snake[0] ?? null : null;
      if (shouldShowSnakeName(self, selfHead, head)) {
        context.fillStyle = self ? '#f0f0f0' : '#b9b9b9';
        context.font = `${self ? '600' : '400'} 11px sans-serif`;
        context.textAlign = 'center';
        context.fillText(self ? `${player.name} · 你` : player.name, headLeft + cell / 2, headCellX < 1 ? headTop + cell + 13 : headTop - 6, Math.min(120, columns * cell));
      }
      if (self && pendingDirs.length) {
        context.fillStyle = '#eaeaea';
        context.font = `600 ${Math.max(9, cell * 0.34)}px sans-serif`;
        context.fillText(pendingDirs.map((queued) => QUEUE_GLYPH[queued]).join(' '), headLeft + cell / 2, headCellX < 1 ? headTop - 8 : headTop - 10, cell * 1.4);
      }
    }
    context.restore();
  }
  context.restore();
  const warning = threat?.mark ?? threat;
  if (warning && warning.x >= x && warning.y >= y && warning.x < x + columns && warning.y < y + rows) {
    context.strokeStyle = '#c4a3a3';
    context.lineWidth = 1.5;
    context.strokeRect(offsetX + (warning.x - x) * cell + 2, offsetY + (warning.y - y) * cell + 2, cell - 4, cell - 4);
  }
  if (view.cropped) {
    drawEdgeFades(context, gridSize, view);
    const self = gameState.players.find((player) => player.id === playerId);
    const head = self?.alive ? self.snake[0] : undefined;
    const food = head ? nearestFood(head, gameState.foods) : null;
    const pointer = food ? foodPointer(view, food) : null;
    const frame = minimapFrame(width, height, gridSize.w, gridSize.h);
    const foodPlaced = pointer ? placeClearOf(offsetX + (pointer.x - x) * cell, offsetY + (pointer.y - y) * cell, frame) : null;
    if (pointer && foodPlaced) {
      const angle = Math.atan2(pointer.dy, pointer.dx);
      context.save();
      context.translate(foodPlaced.x, foodPlaced.y);
      context.rotate(angle);
      context.fillStyle = '#f2f2f2';
      context.beginPath();
      context.moveTo(8, 0);
      context.lineTo(-6, 5);
      context.lineTo(-6, -5);
      context.closePath();
      context.fill();
      context.restore();
      context.fillStyle = '#ddd';
      context.font = '11px sans-serif';
      context.textAlign = 'center';
      context.fillText(String(food?.distance ?? ''), foodPlaced.x, foodPlaced.y - 12);
    }
    const rival = head ? nearestOpponent(playerId, head, gameState.players) : null;
    const rivalPointer = rival ? foodPointer(view, rival) : null;
    if (rival && rivalPointer) {
      const raw = placeClearOf(offsetX + (rivalPointer.x - x) * cell, offsetY + (rivalPointer.y - y) * cell, frame);
      const shifted = foodPlaced ? separateMarkers(foodPlaced, raw) : raw;
      const placed = foodPlaced ? placeClearOf(shifted.x, shifted.y, frame) : raw;
      const angle = Math.atan2(rivalPointer.dy, rivalPointer.dx);
      context.save();
      context.translate(placed.x, placed.y);
      context.rotate(angle);
      context.strokeStyle = '#c4a3a3';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(7, 0);
      context.lineTo(0, 4);
      context.lineTo(-7, 0);
      context.lineTo(0, -4);
      context.closePath();
      context.stroke();
      context.restore();
      context.fillStyle = '#c4a3a3';
      context.font = '11px sans-serif';
      context.textAlign = 'center';
      context.fillText(String(rival.distance), placed.x, placed.y + 16);
    }
    drawMinimap(context, width, height, gridSize, view, gameState, playerId, longestId);
  }
}
