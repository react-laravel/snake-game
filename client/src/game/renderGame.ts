import type { GameState, GridSize, SnakeSegment } from '../types/game';

interface Viewport { cell: number; x: number; y: number; columns: number; rows: number; offsetX: number; offsetY: number; cropped: boolean; }
export interface RenderCache { background: HTMLCanvasElement | null; backgroundKey: string; head: SnakeSegment | null; }
interface RenderGameOptions { context: CanvasRenderingContext2D; width: number; height: number; dpr: number; cache: RenderCache; gameState: GameState | null; playerId: string | null; gridSize: GridSize; }

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

function drawMinimap(context: CanvasRenderingContext2D, width: number, height: number, grid: GridSize, view: Viewport, state: GameState, playerId: string | null) {
  const scale = Math.min(1.8, (width * 0.28) / grid.w);
  const mapWidth = grid.w * scale;
  const mapHeight = grid.h * scale;
  const left = width - mapWidth - 16;
  const top = height - mapHeight - 16;
  context.fillStyle = 'rgba(18,18,18,0.92)'; context.fillRect(left - 5, top - 5, mapWidth + 10, mapHeight + 10);
  context.strokeStyle = '#666'; context.lineWidth = 1; context.strokeRect(left, top, mapWidth, mapHeight);
  context.fillStyle = 'rgba(255,255,255,0.08)'; context.fillRect(left + view.x * scale, top + view.y * scale, view.columns * scale, view.rows * scale);
  context.strokeStyle = '#999'; context.strokeRect(left + view.x * scale, top + view.y * scale, view.columns * scale, view.rows * scale);
  context.fillStyle = '#dadada';
  for (const food of state.foods) {
    context.beginPath();
    context.arc(left + (food.x + 0.5) * scale, top + (food.y + 0.5) * scale, Math.max(1.2, scale * 0.35), 0, Math.PI * 2);
    context.fill();
  }
  for (const player of state.players) {
    if (!player.alive) continue;
    context.globalAlpha = player.frozen ? 0.45 : 1;
    context.fillStyle = player.id === playerId ? '#fff' : player.color;
    for (const segment of player.snake) context.fillRect(left + segment.x * scale, top + segment.y * scale, Math.max(2, scale), Math.max(2, scale));
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

export function renderGame({ context, width, height, dpr, cache, gameState, playerId, gridSize }: RenderGameOptions) {
  const currentPlayer = gameState?.players.find((player) => player.id === playerId);
  if (currentPlayer?.snake[0]) cache.head = currentPlayer.snake[0];
  const view = getViewport(width, height, gridSize, cache.head);
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
  for (const food of gameState.foods) {
    const fx = food.x - x, fy = food.y - y;
    if (fx < 0 || fx >= columns || fy < 0 || fy >= rows) continue;
    context.fillStyle = '#dadada'; context.beginPath(); context.arc(offsetX + (fx + 0.5) * cell, offsetY + (fy + 0.5) * cell, Math.max(2, cell * 0.22), 0, Math.PI * 2); context.fill();
  }
  for (const player of gameState.players) {
    if (!player.alive || !player.snake.length) continue;
    const self = player.id === playerId;
    context.save();
    if (player.frozen) context.globalAlpha = 0.45;
    context.fillStyle = player.color;
    for (let i = player.snake.length - 1; i >= 0; i--) {
      const sx = player.snake[i].x - x, sy = player.snake[i].y - y;
      if (sx < 0 || sx >= columns || sy < 0 || sy >= rows) continue;
      const left = offsetX + sx * cell, top = offsetY + sy * cell;
      context.fillStyle = i === 0 && self ? '#f5f5f5' : player.color;
      context.fillRect(left + 1, top + 1, cell - 2, cell - 2);
      if (i !== 0) continue;
      if (self) { context.strokeStyle = '#fff'; context.lineWidth = 1; context.strokeRect(left - 1, top - 1, cell + 2, cell + 2); }
      const dir = player.dir ?? 'right';
      const points = dir === 'up' ? [[0.3, 0.28], [0.7, 0.28]] : dir === 'down' ? [[0.3, 0.72], [0.7, 0.72]] : dir === 'left' ? [[0.28, 0.3], [0.28, 0.7]] : [[0.72, 0.3], [0.72, 0.7]];
      context.fillStyle = '#161616';
      for (const [ex, ey] of points) { context.beginPath(); context.arc(left + ex * cell, top + ey * cell, Math.max(1.2, cell * 0.08), 0, Math.PI * 2); context.fill(); }
      context.fillStyle = self ? '#f0f0f0' : '#b9b9b9'; context.font = `${self ? '600' : '400'} 11px sans-serif`; context.textAlign = 'center';
      // Keep the label inside the playable area even near its top edge.
      context.fillText(self ? `${player.name} · 你` : player.name, left + cell / 2, sy < 1 ? top + cell + 13 : top - 6, Math.min(120, columns * cell));
    }
    context.restore();
  }
  context.restore();
  if (view.cropped) {
    drawEdgeFades(context, gridSize, view);
    drawMinimap(context, width, height, gridSize, view, gameState, playerId);
  }
}
