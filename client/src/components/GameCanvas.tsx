import { useCallback, useEffect, useRef } from 'react';
import { immediateThreat } from '../game/lookahead';
import { longestAliveId } from '../game/longest';
import { renderGame, type RenderCache } from '../game/renderGame';
import type { Dir, GameState, GridSize } from '../types/game';

interface GameCanvasProps { gameState: GameState | null; playerId: string | null; gridSize: GridSize; pendingDirs: Dir[]; }

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function GameCanvas({ gameState, playerId, gridSize, pendingDirs }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const cacheRef = useRef<RenderCache>({ background: null, backgroundKey: '', head: null });
  const dataRef = useRef({ gameState, playerId, gridSize, pendingDirs });
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const motionRef = useRef({ blend: 1, start: 0, tickMs: 150, seq: -1 });
  dataRef.current = { gameState, playerId, gridSize, pendingDirs };

  const draw = useCallback(() => {
    frameRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || document.hidden) return;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context || sizeRef.current.width <= 0 || sizeRef.current.height <= 0) return;
    const motion = motionRef.current;
    let motionBlend = prefersReducedMotion() ? 1 : motion.blend;
    if (!prefersReducedMotion() && motion.blend < 1) {
      motion.blend = Math.min(1, (performance.now() - motion.start) / motion.tickMs);
      motionBlend = motion.blend;
    }
    const data = dataRef.current;
    const threat = immediateThreat(data.gameState?.players ?? [], data.playerId, data.pendingDirs, data.gridSize);
    const longestId = longestAliveId((data.gameState?.players ?? []).map((player) => ({ id: player.id, alive: player.alive, length: player.snake.length })));
    renderGame({ context, ...sizeRef.current, cache: cacheRef.current, ...data, motionBlend, threat, longestId });
    if (!prefersReducedMotion() && motion.blend < 1 && !document.hidden) {
      frameRef.current = requestAnimationFrame(draw);
    }
  }, []);

  const scheduleDraw = useCallback(() => {
    if (frameRef.current === null && !document.hidden) frameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const seq = gameState?.seq;
    const tickMs = gameState?.tickMs ?? 150;
    if (seq !== undefined && seq !== motionRef.current.seq) {
      motionRef.current = { blend: prefersReducedMotion() ? 1 : 0, start: performance.now(), tickMs, seq };
    }
    scheduleDraw();
  }, [gameState, playerId, gridSize, pendingDirs, scheduleDraw]);

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
