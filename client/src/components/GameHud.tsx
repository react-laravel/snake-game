import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DeathEvent, Dir, JoystickState, ScoreEntry } from '../types/game';
import { DeathFeed } from './DeathFeed';
import { DeathOverlay } from './DeathOverlay';
import { ScoreBadge } from './ScoreBadge';
import { Scoreboard } from './Scoreboard';
import { VirtualJoystick } from './VirtualJoystick';

interface GameHudProps {
  children: ReactNode;
  deaths: DeathEvent[];
  isDead: boolean;
  joystick: JoystickState;
  joystickSize: number;
  playerId: string | null;
  score: number;
  sortedScores: Array<[string, ScoreEntry]>;
  connectionStatus: string;
  connectionError: string | null;
  respawning: boolean;
  onRespawn: () => void;
  onLeave: () => void;
  onRetry: () => void;
  onDirectionChange: (direction: Dir) => void;
}

export function GameHud({ children, deaths, isDead, joystick, joystickSize, playerId, score, sortedScores, connectionStatus, connectionError, respawning, onRespawn, onLeave, onRetry, onDirectionChange }: GameHudProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const connected = connectionStatus === 'connected';
  const reasonRef = useRef('碰撞出局，下次留意墙壁与蛇身。');
  const lastDeath = [...deaths].reverse().find((event) => event.victim === playerId);
  if (!isDead) reasonRef.current = '碰撞出局，下次留意墙壁与蛇身。';
  else if (lastDeath) reasonRef.current = lastDeath.killerName ? `被 ${lastDeath.killerName} 击杀，下次提前转弯。` : '碰撞出局，下次留意墙壁与蛇身。';
  const reason = reasonRef.current;

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError('');
    } catch { setFullscreenError('当前浏览器无法进入全屏'); }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]'))) return;
      event.preventDefault();
      void toggleFullscreen();
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('fullscreenchange', onChange); window.removeEventListener('keydown', onKeyDown); };
  }, []);

  return (
    <main className="game-layout">
      <header className="game-topbar" data-no-joystick>
        <div className="game-brand"><span className="brand-mark" aria-hidden="true">S</span><div><strong>SNAKE ARENA</strong><span>多人竞技场</span></div></div>
        <div className="session-status" role="status"><span className={`status-dot ${connected ? '' : 'status-dot-offline'}`} />{connected ? '已连接' : connectionStatus === 'error' ? '连接中断' : '正在重连…'}</div>
        <ScoreBadge score={score} />
        <div className="game-actions"><button className="secondary-button fullscreen-button" onClick={() => void toggleFullscreen()} title="全屏 (F)">{fullscreen ? '退出全屏' : '全屏 ↗'}</button><button className="secondary-button" onClick={onLeave}>离开</button></div>
      </header>
      {(connectionError || !connected || fullscreenError) && <div className="connection-banner" role="status" data-no-joystick><span>{connectionError || fullscreenError || '正在恢复连接，请稍候…'}</span>{connectionStatus === 'error' && <button className="text-button" onClick={onRetry}>重新连接</button>}</div>}
      <div className="game-stage">
        <div className="arena" data-game-surface>
          {children}
          <VirtualJoystick joystick={joystick} size={joystickSize} />
          {!isDead && connected && <div className={`direction-pad ${joystick.active ? 'direction-pad-hidden' : ''}`} data-no-joystick aria-label="方向控制">{(['up', 'left', 'down', 'right'] as Dir[]).map((dir) => <button key={dir} className={`direction-${dir}`} onClick={() => onDirectionChange(dir)} aria-label={{ up: '向上', down: '向下', left: '向左', right: '向右' }[dir]}>{ { up: '↑', down: '↓', left: '←', right: '→' }[dir]}</button>)}</div>}
          <DeathFeed deaths={deaths} />
          {isDead && <DeathOverlay score={score} reason={reason} respawning={respawning} disabled={!connected} onRespawn={onRespawn} onLeave={onLeave} />}
        </div>
        <Scoreboard sortedScores={sortedScores} playerId={playerId} />
      </div>
      <footer className="game-footer"><span><kbd>WASD</kbd> / 方向键移动 <span className="desktop-hint">· <kbd>F</kbd> 全屏</span><span className="mobile-hint">· 拖动地图使用摇杆</span></span><span>食物 +10 <span className="desktop-hint">· 击杀 +100</span></span></footer>
    </main>
  );
}
