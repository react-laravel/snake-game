import { useEffect, useRef, useState, useCallback } from 'react';

interface SnakeSegment { x: number; y: number; }
interface Player { id: string; name: string; snake: SnakeSegment[]; alive: boolean; color: string; }
interface Food { id: string; x: number; y: number; }
interface ScoreEntry { score: number; name: string; alive: boolean; }
interface GameState { players: Player[]; foods: Food[]; scores: Record<string, ScoreEntry>; }
interface DeathEvent { victim: string; victimName: string; killer: string | null; killerName: string | null; }
type Dir = 'up' | 'down' | 'left' | 'right';

const CELL_REM = 0.85;
const BASE_FONT_PX = 16;
const JBASE = 110;

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
  const [joystick, setJoystick] = useState({ active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 });
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const lastDirRef = useRef<Dir>('right');
  const reconnectTokenRef = useRef<string | null>(null);
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
        if (playerId && msg.scores[playerId]) setMyScore(msg.scores[playerId].score);
      }
      if (msg.type === 'playerDied') {
        setDeaths(d => [...d.slice(-4), { victim: msg.victim, victimName: msg.victimName, killer: msg.killer, killerName: msg.killerName }]);
        setTimeout(() => setDeaths(d => d.slice(1)), 3000);
      }
      if (msg.type === 'youDied') {
        setIsDead(true);
        setDeaths(d => [...d.slice(-4), { victim: playerId || 'you', victimName: '你', killer: null, killerName: msg.killerName }]);
        setTimeout(() => setDeaths(d => d.slice(1)), 3000);
      }
    };
    ws.onclose = () => { wsRef.current = null; };
  }, [joined, name, playerId]);

  useEffect(() => { connect(); }, []);

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
    const HALF = JBASE / 2;

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
        if (dist > HALF) {
          dx = dx / dist * HALF;
          dy = dy / dist * HALF;
        }
        setJoystick({ active: true, dx, dy, baseX: origin.x, baseY: origin.y });
        if (dist > HALF * 0.3) {
          const absDx = Math.abs(dx), absDy = Math.abs(dy);
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

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = '#252545';
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

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00ff88';
      const bx = -camX * CELL_PX;
      const by = -camY * CELL_PX;
      ctx.strokeRect(bx + 1.5, by + 1.5, gridSize.w * CELL_PX - 3, gridSize.h * CELL_PX - 3);
      ctx.shadowBlur = 0;

      if (gameState) {
        for (const food of gameState.foods) {
          const sx = food.x - camX;
          const sy = food.y - camY;
          if (sx < -1 || sx > cols + 1 || sy < -1 || sy > rows + 1) continue;
          const hue = (food.x * 7 + food.y * 13) % 360;
          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
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
            ctx.fillStyle = isMe ? '#00ff88' : 'rgba(255,255,255,0.8)';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(player.name, (hx + 0.5) * CELL_PX, hy * CELL_PX - 4);
          }
        }
      }

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(6, 6, 60, 22);
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`FPS ${fpsRef.current.displayFps}`, 10, 22);

      const alive = gameState?.players.filter(p => p.alive).length ?? 0;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W - 80, 6, 74, 22);
      ctx.fillStyle = '#88ccff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`👾 ${alive}`, W - 76, 22);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, gridSize, playerId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    reconnectTokenRef.current = null;
    connect();
  };

  const handleRespawn = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'respawn' }));
      setIsDead(false);
    }
  };

  const sortedScores = gameState
    ? Object.entries(gameState.scores).sort((a, b) => b[1].score - a[1].score)
    : [];



  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0d0d1a', fontFamily: "'Segoe UI', sans-serif", touchAction: 'none' }}>
      {!joined ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <h1 style={{ color: '#00ff88', fontSize: 32, textShadow: '0 0 20px #00ff8866', margin: 0 }}>🐍 贪吃蛇多人对战</h1>
          <p style={{ color: '#888', fontSize: 16 }}>输入名字后直接进入房间</p>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="你的名字" maxLength={20}
              style={{ padding: '12px 16px', fontSize: 18, borderRadius: 10, border: '2px solid #00ff88', background: '#0a0a1a', color: '#fff', outline: 'none', width: 220, textAlign: 'center' }} />
            <button type="submit" style={{ padding: '12px 28px', fontSize: 18, borderRadius: 10, border: 'none', background: '#00ff88', color: '#0d0d1a', fontWeight: 700, cursor: 'pointer' }}>进入</button>
          </form>
          <p style={{ color: '#555', fontSize: 13 }}>方向键 / WASD 控制 · 手机左下角摇杆</p>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} style={{ display: 'block' }} />

          {/* Virtual joystick — follows touch position */}
          {joystick.active && (
            <div style={{
              position: 'absolute',
              left: joystick.baseX - JBASE / 2,
              top: joystick.baseY - JBASE / 2,
              width: JBASE,
              height: JBASE,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              border: '2px solid rgba(255,255,255,0.18)',
              touchAction: 'none',
              userSelect: 'none',
              zIndex: 100,
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: 'rgba(0,255,136,0.7)',
                border: '2px solid #00ff88',
                transform: `translate(calc(-50% + ${joystick.dx}px), calc(-50% + ${joystick.dy}px))`,
                pointerEvents: 'none',
                boxShadow: '0 0 14px #00ff88',
              }} />
            </div>
          )}

          {isDead && (
            <div data-no-joystick onClick={handleRespawn}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', zIndex: 200 }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>💀</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>你已死亡</div>
              <div style={{ fontSize: 15, color: '#aaa', marginTop: 10 }}>点击任意处复活</div>
            </div>
          )}

          {deaths.map((d, i) => (
            <div key={i} style={{
              position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.82)', padding: '14px 24px', borderRadius: 14, color: '#fff',
              fontSize: 17, textAlign: 'center', pointerEvents: 'none', border: '1px solid #ff4466',
              animation: 'fadeOut 3s forwards',
            }}>
              {d.killer ? (
                <span>💀 <b>{d.victimName}</b> 被 <b>{d.killerName}</b> 击杀！<span style={{ color: '#ffd700' }}>+100</span></span>
              ) : (
                <span>💀 <b>{d.victimName}</b> 撞墙了</span>
              )}
            </div>
          ))}

          <div data-no-joystick style={{
            position: 'absolute',
            ...(isLandscape
              ? { top: 0, right: 0, bottom: 0, width: 180, borderLeft: '1px solid #1a1a2e' }
              : { bottom: 0, left: 0, right: 0, maxHeight: '30vh', borderTop: '1px solid #1a1a2e' }),
            background: 'rgba(13,13,26,0.9)', overflowY: 'auto',
          }}>
            <div style={{ padding: '6px 10px', color: '#555', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>📊 排行榜</div>
            {sortedScores.map(([id, entry], idx) => (
              <div key={id} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px',
                background: id === playerId ? 'rgba(0,255,136,0.08)' : 'transparent',
                color: entry.alive ? '#ccc' : '#444', borderBottom: '1px solid #111',
              }}>
                <span style={{ width: 18, color: idx < 3 ? '#ffd700' : '#444', fontWeight: 700, fontSize: 12 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}{id === playerId ? ' (我)' : ''}{!entry.alive && <span style={{ color: '#f44', fontSize: 10, marginLeft: 4 }}>💀</span>}</span>
                <span style={{ color: entry.alive ? '#00ff88' : '#555', fontWeight: 700, fontSize: 12 }}>{entry.score}</span>
              </div>
            ))}
          </div>

          <div style={{ position: 'absolute', top: 10, right: 10, color: '#fff', fontSize: 14, fontWeight: 700, background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 6 }}>🎯 {myScore}</div>
        </>
      )}
      <style>{`
        @keyframes fadeOut { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
        input::placeholder { color: #555; }
        input:focus { border-color: #00ff88 !important; box-shadow: 0 0 12px #00ff8833; }
      `}</style>
    </div>
  );
}
