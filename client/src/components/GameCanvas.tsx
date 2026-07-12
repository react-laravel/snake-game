import { useCallback, useEffect, useRef } from 'react';
import { renderGame, type FpsState } from '../game/renderGame';
import type { GameState, GridSize } from '../types/game';

interface GameCanvasProps {
  gameState: GameState | null;
  playerId: string | null;
  gridSize: GridSize;
}

export function GameCanvas({ gameState, playerId, gridSize }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const virtualTimeRef = useRef(performance.now());
  const fpsRef = useRef<FpsState>({ frames: 0, last: performance.now(), display: 0 });
  const dataRef = useRef({ gameState, playerId, gridSize });
  dataRef.current = { gameState, playerId, gridSize };

  const draw = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    renderGame({ canvas, context, now, fps: fpsRef.current, ...dataRef.current });
  }, []);

  useEffect(() => {
    const renderFrame = (now: number) => {
      virtualTimeRef.current = now;
      draw(now);
      frameRef.current = requestAnimationFrame(renderFrame);
    };

    const advanceTime = (milliseconds: number) => new Promise<void>((resolve) => {
      const startedAt = performance.now();

      const step = (now: number) => {
        virtualTimeRef.current = now;
        draw(now);
        if (now - startedAt >= milliseconds) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    });

    window.advanceTime = advanceTime;
    frameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(frameRef.current);
      if (window.advanceTime === advanceTime) delete window.advanceTime;
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="game-canvas" />;
}
