import { useCallback, useEffect, useRef } from 'react';
import { renderGame, type RenderCache } from '../game/renderGame';
import type { GameState, GridSize } from '../types/game';

interface GameCanvasProps { gameState: GameState | null; playerId: string | null; gridSize: GridSize; }

export function GameCanvas({ gameState, playerId, gridSize }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const cacheRef = useRef<RenderCache>({ background: null, backgroundKey: '', head: null });
  const dataRef = useRef({ gameState, playerId, gridSize });
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  dataRef.current = { gameState, playerId, gridSize };

  const draw = useCallback(() => {
    frameRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || document.hidden) return;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context || sizeRef.current.width <= 0 || sizeRef.current.height <= 0) return;
    renderGame({ context, ...sizeRef.current, cache: cacheRef.current, ...dataRef.current });
  }, []);

  const scheduleDraw = useCallback(() => {
    if (frameRef.current === null && !document.hidden) frameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => { scheduleDraw(); }, [gameState, playerId, gridSize, scheduleDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { width, height, dpr };
      const pixelWidth = Math.max(1, Math.round(width * dpr)), pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
      scheduleDraw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', scheduleDraw);
    // Multiplayer time belongs to the server. Test bursts wait for real ticks rather than predicting state.
    const advanceTime = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(() => { scheduleDraw(); resolve(); }, Math.max(0, milliseconds)));
    window.advanceTime = advanceTime;
    resize();
    return () => {
      observer.disconnect(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', scheduleDraw);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      if (window.advanceTime === advanceTime) delete window.advanceTime;
    };
  }, [scheduleDraw]);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="竞技场地图，方向键或 WASD 控制，手机可拖动摇杆" />;
}
