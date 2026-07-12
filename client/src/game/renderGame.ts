import { CELL_PX } from './constants';
import type { GameState, GridSize } from '../types/game';

export interface FpsState {
  frames: number;
  last: number;
  display: number;
}

interface RenderGameOptions {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  now: number;
  fps: FpsState;
  gameState: GameState | null;
  playerId: string | null;
  gridSize: GridSize;
}

function updateFps(fps: FpsState, now: number) {
  fps.frames += 1;
  const elapsed = now - fps.last;
  if (elapsed < 1000) return;

  fps.display = Math.round((fps.frames * 1000) / elapsed);
  fps.frames = 0;
  fps.last = now;
}

function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height };
}

function getCamera(
  width: number,
  height: number,
  gridSize: GridSize,
  gameState: GameState | null,
  playerId: string | null,
) {
  const columns = Math.ceil(width / CELL_PX);
  const rows = Math.ceil(height / CELL_PX);
  let x = 0;
  let y = 0;

  if (width < 768 && gameState && playerId) {
    const player = gameState.players.find((entry) => entry.id === playerId);
    const head = player?.snake[0];
    if (head) {
      x = head.x - Math.floor(columns / 2);
      y = head.y - Math.floor(rows / 2);
    }
  }

  return {
    x: Math.max(0, Math.min(x, gridSize.w - columns)),
    y: Math.max(0, Math.min(y, gridSize.h - rows)),
    columns,
    rows,
  };
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number, columns: number, rows: number) {
  context.fillStyle = '#1f1f1f';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#313131';
  context.lineWidth = 0.5;

  for (let column = 0; column <= columns; column += 1) {
    context.beginPath();
    context.moveTo(column * CELL_PX, 0);
    context.lineTo(column * CELL_PX, height);
    context.stroke();
  }

  for (let row = 0; row <= rows; row += 1) {
    context.beginPath();
    context.moveTo(0, row * CELL_PX);
    context.lineTo(width, row * CELL_PX);
    context.stroke();
  }
}

function drawBoundary(context: CanvasRenderingContext2D, gridSize: GridSize, cameraX: number, cameraY: number) {
  context.strokeStyle = '#d4d4d4';
  context.lineWidth = 2;
  context.shadowBlur = 8;
  context.shadowColor = 'rgba(255,255,255,0.28)';
  context.strokeRect(
    -cameraX * CELL_PX + 1.5,
    -cameraY * CELL_PX + 1.5,
    gridSize.w * CELL_PX - 3,
    gridSize.h * CELL_PX - 3,
  );
  context.shadowBlur = 0;
}

function drawEntities(
  context: CanvasRenderingContext2D,
  gameState: GameState,
  playerId: string | null,
  cameraX: number,
  cameraY: number,
  columns: number,
  rows: number,
) {
  for (const food of gameState.foods) {
    const x = food.x - cameraX;
    const y = food.y - cameraY;
    if (x < -1 || x > columns + 1 || y < -1 || y > rows + 1) continue;

    const shade = 180 + ((food.x * 7 + food.y * 13) % 65);
    context.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    context.beginPath();
    context.arc((x + 0.5) * CELL_PX, (y + 0.5) * CELL_PX, CELL_PX * 0.38, 0, Math.PI * 2);
    context.fill();
  }

  for (const player of gameState.players) {
    if (!player.alive || player.snake.length === 0) continue;

    const isCurrentPlayer = player.id === playerId;
    for (const segment of player.snake.slice(1)) {
      const x = segment.x - cameraX;
      const y = segment.y - cameraY;
      if (x < -0.5 || x > columns + 0.5 || y < -0.5 || y > rows + 0.5) continue;

      context.fillStyle = player.color;
      context.fillRect(x * CELL_PX + 1, y * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
    }

    const head = player.snake[0];
    const headX = head.x - cameraX;
    const headY = head.y - cameraY;
    if (headX < -0.5 || headX > columns + 0.5 || headY < -0.5 || headY > rows + 0.5) continue;

    context.fillStyle = isCurrentPlayer ? '#ffffff' : player.color;
    context.fillRect(headX * CELL_PX + 1, headY * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
    context.fillStyle = '#000';
    context.fillRect(headX * CELL_PX + CELL_PX * 0.2, headY * CELL_PX + CELL_PX * 0.2, CELL_PX * 0.18, CELL_PX * 0.18);
    context.fillRect(headX * CELL_PX + CELL_PX * 0.62, headY * CELL_PX + CELL_PX * 0.2, CELL_PX * 0.18, CELL_PX * 0.18);
    context.fillStyle = isCurrentPlayer ? '#f0f0f0' : 'rgba(255,255,255,0.8)';
    context.font = 'bold 10px sans-serif';
    context.textAlign = 'center';
    context.fillText(player.name, (headX + 0.5) * CELL_PX, headY * CELL_PX - 4);
  }
}

function drawDiagnostics(
  context: CanvasRenderingContext2D,
  width: number,
  fps: number,
  alivePlayers: number,
) {
  context.textAlign = 'left';
  context.fillStyle = 'rgba(0,0,0,0.55)';
  context.fillRect(6, 6, 60, 22);
  context.fillStyle = '#efefef';
  context.font = 'bold 13px monospace';
  context.fillText(`FPS ${fps}`, 10, 22);

  context.fillStyle = 'rgba(0,0,0,0.55)';
  context.fillRect(width - 80, 6, 74, 22);
  context.fillStyle = '#c7c7c7';
  context.fillText(`ALV ${alivePlayers}`, width - 76, 22);
}

export function renderGame({
  canvas,
  context,
  now,
  fps,
  gameState,
  playerId,
  gridSize,
}: RenderGameOptions) {
  updateFps(fps, now);
  const { width, height } = resizeCanvas(canvas, context);
  const camera = getCamera(width, height, gridSize, gameState, playerId);

  drawGrid(context, width, height, camera.columns, camera.rows);
  drawBoundary(context, gridSize, camera.x, camera.y);
  if (gameState) {
    drawEntities(context, gameState, playerId, camera.x, camera.y, camera.columns, camera.rows);
  }
  drawDiagnostics(context, width, fps.display, gameState?.players.filter((player) => player.alive).length ?? 0);
}
