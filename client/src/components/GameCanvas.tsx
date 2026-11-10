import { useCallback, useEffect, useRef } from 'react';
import { immediateThreat } from '../game/lookahead';
import { longestAliveId } from '../game/longest';
import { rememberSpawnHint, runwayHintCopy, shouldShowSpawnRunway, snakeBlockKeys, spawnRunway } from '../game/runway';
import { cameraFollowId, cameraPanDuration, cameraPanProgress, easeCameraPan, startCameraPan } from '../game/spectator';
import { getViewport, renderGame, type RenderCache } from '../game/renderGame';
import type { Dir, GameState, GridSize } from '../types/game';

interface GameCanvasProps {
  gameState: GameState | null;
  playerId: string | null;
  gridSize: GridSize;
  pendingDirs: Dir[];
  isDead?: boolean;
  spectator?: { id: string; name: string } | null;
  onWatching?: (name: string | null) => void;
  onRunwayHint?: (hint: string | null) => void;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function GameCanvas({ gameState, playerId, gridSize, pendingDirs, isDead = false, spectator = null, onWatching, onRunwayHint }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const cacheRef = useRef<RenderCache>({ background: null, backgroundKey: '', head: null });
  const dataRef = useRef({ gameState, playerId, gridSize, pendingDirs, isDead, spectator });
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const motionRef = useRef({ blend: 1, start: 0, tickMs: 150, seq: -1 });
  const watchingRef = useRef<string | null>(null);
  const onWatchingRef = useRef(onWatching);
  const onRunwayHintRef = useRef(onRunwayHint);
  const spawnHintRef = useRef<{ alive: boolean; startedAt: number | null }>({ alive: false, startedAt: null });
  const runwayHintRef = useRef<string | null>(null);
  const panRef = useRef<{ followId: string | null; from: { x: number; y: number } | null; start: number; duration: number }>({
    followId: null, from: null, start: 0, duration: 0,
  });
  dataRef.current = { gameState, playerId, gridSize, pendingDirs, isDead, spectator };
  onWatchingRef.current = onWatching;
  onRunwayHintRef.current = onRunwayHint;

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
    const size = sizeRef.current;
    const cropped = size.width > 0 && size.height > 0 && getViewport(size.width, size.height, data.gridSize, null).cropped;
    const followId = cameraFollowId(data.isDead, cropped, data.spectator?.id ?? null);
    const watchingName = followId ? data.spectator?.name ?? null : null;
    if (watchingRef.current !== watchingName) {
      watchingRef.current = watchingName;
      onWatchingRef.current?.(watchingName);
    }
    const reducedMotion = prefersReducedMotion();
    const pan = panRef.current;
    const plan = startCameraPan({
      isDead: data.isDead,
      reducedMotion,
      previousFollowId: pan.followId,
      nextFollowId: followId,
      lastCamera: cacheRef.current.head,
    });
    if (plan.snap) {
      panRef.current = { followId, from: null, start: 0, duration: 0 };
    } else if (plan.panFrom) {
      const follow = followId ? data.gameState?.players.find((player) => player.id === followId && player.alive && player.snake.length > 0) : undefined;
      const target = follow?.snake[0] ?? null;
      panRef.current = {
        followId,
        from: plan.panFrom,
        start: performance.now(),
        duration: cameraPanDuration(plan.panFrom, target),
      };
    } else {
      pan.followId = followId;
    }
    const activePan = panRef.current;
    const panProgress = easeCameraPan(cameraPanProgress(performance.now() - activePan.start, activePan.duration, !activePan.from));
    if (activePan.from && panProgress >= 1) activePan.from = null;
    const self = data.gameState?.players.find((player) => player.id === data.playerId);
    const selfAlive = Boolean(self?.alive);
    const now = performance.now();
    const startedAt = rememberSpawnHint(spawnHintRef.current.alive, selfAlive, now, spawnHintRef.current.startedAt);
    spawnHintRef.current = { alive: selfAlive, startedAt };
    const showRunway = shouldShowSpawnRunway({ alive: selfAlive, startedAt, nowMs: now });
    const runway = showRunway && self
      ? spawnRunway(self.snake[0], self.dir, data.gridSize, snakeBlockKeys(data.gameState?.players ?? []))
      : [];
    const runwayHint = runwayHintCopy(runway.length);
    if (runwayHintRef.current !== runwayHint) {
      runwayHintRef.current = runwayHint;
      onRunwayHintRef.current?.(runwayHint);
    }
    renderGame({ context, ...size, cache: cacheRef.current, gameState: data.gameState, playerId: data.playerId, gridSize: data.gridSize, pendingDirs: data.pendingDirs, motionBlend, threat, longestId, followId, panFrom: activePan.from, panProgress, runway });
    if (!document.hidden && ((!reducedMotion && motion.blend < 1) || Boolean(panRef.current.from) || showRunway)) {
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
  }, [gameState, playerId, gridSize, pendingDirs, isDead, spectator, scheduleDraw]);

  useEffect(() => {
    if (isDead) {
      spawnHintRef.current = { alive: false, startedAt: null };
      if (runwayHintRef.current !== null) {
        runwayHintRef.current = null;
        onRunwayHintRef.current?.(null);
      }
      return;
    }
    panRef.current = { followId: null, from: null, start: 0, duration: 0 };
    if (watchingRef.current === null) return;
    watchingRef.current = null;
    onWatchingRef.current?.(null);
  }, [isDead]);

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
