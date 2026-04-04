import { useCallback, useEffect, useRef, useState } from 'react';
import { DeathFeed } from './components/DeathFeed';
import { DeathOverlay } from './components/DeathOverlay';
import { JoinScreen } from './components/JoinScreen';
import { ScoreBadge } from './components/ScoreBadge';
import { Scoreboard } from './components/Scoreboard';
import { VirtualJoystick } from './components/VirtualJoystick';
import type { DeathEvent, Dir, GameState, JoystickState, ScoreEntry } from './types/game';

const CELL_REM = 0.85;
const BASE_FONT_PX = 16;
const JOYSTICK_SIZE = 110;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState({ w: 60, h: 40 });
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [deaths, setDeaths] = useState<DeathEvent[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [isDead, setIsDead] = useState(false);
  const [joystick, setJoystick] = useState<JoystickState>({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const lastDirRef = useRef<Dir>('right');
  const fpsRef = useRef({ frames: 0, last: performance.now(), displayFps: 0 });
  const rafRef = useRef<number>(0);
  const joystickTouchId = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number } | null>(null);

  const CELL_PX = CELL_REM * BASE_FONT_PX;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/snake/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const savedToken = localStorage.getItem('snake_token');
      if (savedToken) {
        localStorage.removeItem('snake_token');
        localStorage.removeItem('snake_playerId');
        ws.send(JSON.stringify({ type: 'rejoin', token: savedToken }));
      } else if (!joined) {
        ws.send(JSON.stringify({ type: 'join', playerName: name.trim() || '匿名蛇' }));
      }
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'welcome') {
        setPlayerId(msg.playerId);
        setGridSize({ w: msg.gridWidth, h: msg.gridHeight });
        setJoined(true);
        setIsDead(false);
        localStorage.setItem('snake_playerId', msg.playerId);
        if (msg.reconnectToken) localStorage.setItem('snake_token', msg.reconnectToken);
      }
      if (msg.type === 'gameState') {
        setGameState({ players: msg.players, foods: msg.foods, scores: msg.scores });
        const currentPlayerId = playerId || localStorage.getItem('snake_playerId');
        if (currentPlayerId && msg.scores[currentPlayerId]) {
          setMyScore(msg.scores[currentPlayerId].score);
        }
      }
      if (msg.type === 'playerDied') {
        setDeaths((prev) => [
          ...prev.slice(-4),
          { victim: msg.victim, victimName: msg.victimName, killer: msg.killer, killerName: msg.killerName },
        ]);
        setTimeout(() => setDeaths((prev) => prev.slice(1)), 3000);
      }
      if (msg.type === 'youDied') {
        setIsDead(true);
        setDeaths((prev) => [
          ...prev.slice(-4),
          { victim: playerId || 'you', victimName: '你', killer: null, killerName: msg.killerName },
        ]);
        setTimeout(() => setDeaths((prev) => prev.slice(1)), 3000);
      }
    };
    ws.onclose = () => {
      wsRef.current = null;
    };
  }, [joined, name, playerId]);

  useEffect(() => {
    connect();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const sendDir = useCallback((dir: Dir) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const opposites: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
      if (lastDirRef.current !== opposites[dir]) {
        wsRef.current.send(JSON.stringify({ type: 'direction', dir }));
        lastDirRef.current = dir;
      }
    }
  }, []);

  // Keyboard
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
    };
    const handler = (e: KeyboardEvent) => {
      if (map[e.key]) { e.preventDefault(); sendDir(map[e.key]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sendDir]);

  // Virtual joystick — follows touch position
  useEffect(() => {
    const half = JOYSTICK_SIZE / 2;

    const onTouchStart = (e: TouchEvent) => {
      if (joystickTouchId.current !== null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const target = t.target as HTMLElement;
        if (target.closest('[data-no-joystick]')) continue;
        e.preventDefault();
        joystickTouchId.current = t.identifier;
        joystickOriginRef.current = { x: t.clientX, y: t.clientY };
        setJoystick({ active: true, dx: 0, dy: 0, baseX: t.clientX, baseY: t.clientY });
        break;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (joystickTouchId.current === null) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== joystickTouchId.current) continue;
        const origin = joystickOriginRef.current;
        if (!origin) continue;
        let dx = t.clientX - origin.x;
        let dy = t.clientY - origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > half) {
          dx = (dx / dist) * half;
          dy = (dy / dist) * half;
        }
        setJoystick({ active: true, dx, dy, baseX: origin.x, baseY: origin.y });
        if (dist > half * 0.3) {
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          if (absDx > absDy) sendDir(dx > 0 ? 'right' : 'left');
          else sendDir(dy > 0 ? 'down' : 'up');
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          joystickTouchId.current = null;
          joystickOriginRef.current = null;
          setJoystick({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
          break;
        }
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [sendDir]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const render = (now: number) => {
      fpsRef.current.frames++;
      const elapsed = now - fpsRef.current.last;
      if (elapsed >= 1000) {
        fpsRef.current.displayFps = Math.round(fpsRef.current.frames * 1000 / elapsed);
        fpsRef.current.frames = 0;
        fpsRef.current.last = now;
      }

      const W = window.innerWidth;
      const H = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      const cols = Math.ceil(W / CELL_PX);
      const rows = Math.ceil(H / CELL_PX);
      let camX = 0, camY = 0;
      const isMobile = W < 768;

      if (isMobile && gameState && playerId) {
        const me = gameState.players.find(p => p.id === playerId);
        if (me && me.snake.length > 0) {
          camX = me.snake[0].x - Math.floor(cols / 2);
          camY = me.snake[0].y - Math.floor(rows / 2);
        }
      }
      camX = Math.max(0, Math.min(camX, gridSize.w - cols));
      camY = Math.max(0, Math.min(camY, gridSize.h - rows));

      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = '#313131';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL_PX, 0);
        ctx.lineTo(c * CELL_PX, H);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL_PX);
        ctx.lineTo(W, r * CELL_PX);
        ctx.stroke();
      }

      ctx.strokeStyle = '#d4d4d4';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255,255,255,0.28)';
      const bx = -camX * CELL_PX;
      const by = -camY * CELL_PX;
      ctx.strokeRect(bx + 1.5, by + 1.5, gridSize.w * CELL_PX - 3, gridSize.h * CELL_PX - 3);
      ctx.shadowBlur = 0;

      if (gameState) {
        for (const food of gameState.foods) {
          const sx = food.x - camX;
          const sy = food.y - camY;
          if (sx < -1 || sx > cols + 1 || sy < -1 || sy > rows + 1) continue;
          const shade = 180 + ((food.x * 7 + food.y * 13) % 65);
          ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
          ctx.beginPath();
          ctx.arc((sx + 0.5) * CELL_PX, (sy + 0.5) * CELL_PX, CELL_PX * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const player of gameState.players) {
          if (!player.alive || player.snake.length === 0) continue;
          const isMe = player.id === playerId;
          for (let i = 1; i < player.snake.length; i++) {
            const seg = player.snake[i];
            const sx = seg.x - camX;
            const sy = seg.y - camY;
            if (sx < -0.5 || sx > cols + 0.5 || sy < -0.5 || sy > rows + 0.5) continue;
            ctx.fillStyle = player.color;
            ctx.fillRect(sx * CELL_PX + 1, sy * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
          }
          const head = player.snake[0];
          const hx = head.x - camX;
          const hy = head.y - camY;
          if (hx >= -0.5 && hx <= cols + 0.5 && hy >= -0.5 && hy <= rows + 0.5) {
            ctx.fillStyle = isMe ? '#ffffff' : player.color;
            ctx.fillRect(hx * CELL_PX + 1, hy * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
            ctx.fillStyle = '#000';
            ctx.fillRect(hx * CELL_PX + CELL_PX * 0.2, hy * CELL_PX + CELL_PX * 0.2, CELL_PX * 0.18, CELL_PX * 0.18);
            ctx.fillRect(hx * CELL_PX + CELL_PX * 0.62, hy * CELL_PX + CELL_PX * 0.2, CELL_PX * 0.18, CELL_PX * 0.18);
            ctx.fillStyle = isMe ? '#f0f0f0' : 'rgba(255,255,255,0.8)';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(player.name, (hx + 0.5) * CELL_PX, hy * CELL_PX - 4);
          }
        }
      }

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(6, 6, 60, 22);
      ctx.fillStyle = '#efefef';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`FPS ${fpsRef.current.displayFps}`, 10, 22);

      const alive = gameState?.players.filter(p => p.alive).length ?? 0;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W - 80, 6, 74, 22);
      ctx.fillStyle = '#c7c7c7';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`ALV ${alive}`, W - 76, 22);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, gridSize, playerId]);

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    connect();
  };

  const handleRespawn = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'respawn' }));
      setIsDead(false);
    }
  };

  const sortedScores: Array<[string, ScoreEntry]> = gameState
    ? Object.entries(gameState.scores).sort((left, right) => right[1].score - left[1].score)
    : [];



  return (
    <div className="app-shell">
      {!joined ? (
        <JoinScreen name={name} onNameChange={setName} onJoin={handleJoin} />
      ) : (
        <>
          <canvas ref={canvasRef} className="game-canvas" />
          <VirtualJoystick joystick={joystick} size={JOYSTICK_SIZE} />
          {isDead ? <DeathOverlay onRespawn={handleRespawn} /> : null}
          <DeathFeed deaths={deaths} />
          <Scoreboard isLandscape={isLandscape} sortedScores={sortedScores} playerId={playerId} />
          <ScoreBadge score={myScore} />
        </>
      )}
    </div>
  );
}
