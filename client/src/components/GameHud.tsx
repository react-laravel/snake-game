import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { deathReason } from '../game/deathCopy';
import { inviteUrl } from '../game/invite';
import { immediateThreat } from '../game/lookahead';
import type { LifeCounters } from '../game/lifeStats';
import type { DeathEvent, Dir, GameState, GridSize, ScoreEntry } from '../types/game';
import type { JoystickVisual } from './VirtualJoystick';
import { DeathFeed } from './DeathFeed';
import { DeathOverlay } from './DeathOverlay';
import { ScoreBadge } from './ScoreBadge';
import { Scoreboard } from './Scoreboard';
import { VirtualJoystick } from './VirtualJoystick';

const DIR_LABEL: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };

interface GameHudProps {
  children: ReactNode;
  deaths: DeathEvent[];
  isDead: boolean;
  life: LifeCounters;
  soundOn: boolean;
  onToggleSound: () => void;
  joystickActive: boolean;
  joystickSize: number;
  joystickVisualRef: RefObject<JoystickVisual | null>;
  onJoystickReady: () => void;
  playerId: string | null;
  score: number;
  personalBest: number;
  pendingDirs: Dir[];
  gameState: GameState | null;
  gridSize: GridSize;
  sortedScores: Array<[string, ScoreEntry]>;
  frozenPlayerIds: Set<string>;
  connectionStatus: string;
  connectionError: string | null;
  latencyMs: number | null;
  respawning: boolean;
  onRespawn: () => void;
  onLeave: () => void;
  onRetry: () => void;
  onDirectionChange: (direction: Dir) => void;
}

export function GameHud({ children, deaths, isDead, life, soundOn, onToggleSound, joystickActive, joystickSize, joystickVisualRef, onJoystickReady, playerId, score, personalBest, pendingDirs, gameState, gridSize, sortedScores, frozenPlayerIds, connectionStatus, connectionError, latencyMs, respawning, onRespawn, onLeave, onRetry, onDirectionChange }: GameHudProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [inviteLabel, setInviteLabel] = useState('邀请');
  const fullscreenTimerRef = useRef<number | null>(null);
  const connected = connectionStatus === 'connected';
  const statusText = connected ? '已连接' : connectionStatus === 'error' ? '连接中断' : connectionStatus === 'connecting' ? '正在连接…' : '正在重连…';
  const reasonRef = useRef('碰撞出局，下次留意墙壁与蛇身。');
  const lastDeath = [...deaths].reverse().find((event) => event.victim === playerId);
  if (!isDead) reasonRef.current = '碰撞出局，下次留意墙壁与蛇身。';
  else if (lastDeath) reasonRef.current = deathReason(lastDeath);
  const reason = reasonRef.current;
  const threat = !isDead && connected ? immediateThreat(gameState?.players ?? [], playerId, pendingDirs, gridSize) : null;
  const place = sortedScores.findIndex(([id]) => id === playerId);
  const rankLabel = place >= 0 ? `第 ${place + 1} / ${sortedScores.length}` : '';
  const me = gameState?.players.find((player) => player.id === playerId);
  const lengthLabel = me?.alive ? `${me.snake.length} 节` : '';
  const toggleSoundRef = useRef(onToggleSound);
  toggleSoundRef.current = onToggleSound;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(window.location.origin, window.location.pathname));
      setInviteLabel('已复制');
    } catch {
      setInviteLabel('无法复制');
    }
    window.setTimeout(() => setInviteLabel('邀请'), 2000);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError('');
    } catch {
      setFullscreenError('当前浏览器无法进入全屏');
      if (fullscreenTimerRef.current !== null) window.clearTimeout(fullscreenTimerRef.current);
      fullscreenTimerRef.current = window.setTimeout(() => {
        fullscreenTimerRef.current = null;
        setFullscreenError('');
      }, 4000);
    }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'm' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]'))) {
        event.preventDefault();
        toggleSoundRef.current();
        return;
      }
      if (event.key.toLowerCase() !== 'f' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]'))) return;
      event.preventDefault();
      void toggleFullscreen();
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKeyDown);
      if (fullscreenTimerRef.current !== null) window.clearTimeout(fullscreenTimerRef.current);
    };
  }, []);

  return (
    <main className="game-layout">
      <header className="game-topbar" data-no-joystick>
        <div className="game-brand"><span className="brand-mark" aria-hidden="true">S</span><div><strong>SNAKE ARENA</strong><span>多人竞技场</span></div></div>
        <div className="session-status" role="status"><span className={`status-dot ${connected ? '' : 'status-dot-offline'}`} />{statusText}{connected && latencyMs !== null && <span className={`latency-pill${latencyMs > 200 ? ' latency-pill-warn' : ''}`} title="往返延迟">{latencyMs} ms</span>}</div>
        <ScoreBadge score={score} personalBest={personalBest} rankLabel={rankLabel} lengthLabel={lengthLabel} />
        <div className="game-actions"><button className="secondary-button" onClick={onToggleSound} aria-pressed={soundOn} title="音效 (M)">{soundOn ? '音效 开' : '音效 关'}</button><button className="secondary-button" onClick={() => void copyInvite()}>{inviteLabel}</button><button className="secondary-button fullscreen-button" onClick={() => void toggleFullscreen()} title="全屏 (F)">{fullscreen ? '退出全屏' : '全屏 ↗'}</button><button className="secondary-button" onClick={onLeave}>离开</button></div>
      </header>
      {(connectionError || !connected || fullscreenError) && <div className="connection-banner" role="status" data-no-joystick><span>{connectionError || fullscreenError || '正在恢复连接，请稍候…'}</span>{connectionStatus === 'error' && <button className="text-button" onClick={onRetry}>重新连接</button>}</div>}
      <div className="game-stage">
        <div className="arena" data-game-surface>
          {children}
          <VirtualJoystick active={joystickActive} size={joystickSize} visualRef={joystickVisualRef} onReady={onJoystickReady} />
          {!isDead && connected && <div className={`direction-pad ${joystickActive ? 'direction-pad-hidden' : ''}`} data-no-joystick aria-label="方向控制">{(['up', 'left', 'down', 'right'] as Dir[]).map((dir) => <button key={dir} className={`direction-${dir}`} onClick={() => onDirectionChange(dir)} aria-label={{ up: '向上', down: '向下', left: '向左', right: '向右' }[dir]}>{ { up: '↑', down: '↓', left: '←', right: '→' }[dir]}</button>)}</div>}
          <DeathFeed deaths={deaths} />
          {isDead && <DeathOverlay score={score} personalBest={personalBest} life={life} reason={reason} respawning={respawning} disabled={!connected} onRespawn={onRespawn} onLeave={onLeave} />}
        </div>
        <Scoreboard sortedScores={sortedScores} playerId={playerId} frozenPlayerIds={frozenPlayerIds} lengths={new Map((gameState?.players ?? []).map((player) => [player.id, player.alive ? player.snake.length : 0]))} />
      </div>
      <footer className="game-footer">
        <span><kbd>WASD</kbd> / 方向键移动 <span className="desktop-hint">· <kbd>F</kbd> 全屏</span><span className="mobile-hint">· 拖动地图使用摇杆</span>{!isDead && pendingDirs.length > 0 && <span className="turn-queue-hint"> · 待转向 {pendingDirs.map((dir) => DIR_LABEL[dir]).join(' ')}</span>}{threat && <span className="threat-hint" role="status"> · {threat.kind === 'head-on' ? '对面要相撞' : threat.kind === 'snake' ? '下一格有蛇' : threat.distance === 2 ? '两格后是墙' : '下一格是墙'}</span>}</span>
        <span>食物 +10 <span className="desktop-hint">· 击杀 +100</span></span>
      </footer>
    </main>
  );
}
