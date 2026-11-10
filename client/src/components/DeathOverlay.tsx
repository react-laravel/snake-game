import { useEffect, useRef } from 'react';
import type { LifeCounters } from '../game/lifeStats';

interface DeathOverlayProps {
  score: number;
  personalBest: number;
  life: LifeCounters;
  reason: string;
  disabled: boolean;
  respawning: boolean;
  onRespawn: () => void;
  onLeave: () => void;
}

export function DeathOverlay({ score, personalBest, life, reason, disabled, respawning, onRespawn, onLeave }: DeathOverlayProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const record = personalBest > 0 && score >= personalBest;

  useEffect(() => {
    if (buttonRef.current && !buttonRef.current.disabled) buttonRef.current.focus();
    else cardRef.current?.focus();
  }, [disabled, respawning]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || disabled || respawning) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      onRespawn();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, onRespawn, respawning]);

  return (
    <div className="death-overlay" data-no-joystick>
      <section ref={cardRef} className="death-card" role="dialog" tabIndex={-1} aria-labelledby="death-title" aria-describedby="death-reason">
        <div className="death-icon" aria-hidden="true">×</div><span className="eyebrow">ROUND OVER</span>
        <h2 id="death-title">这次就到这里。</h2><p id="death-reason">{reason}</p>
        <div className="death-score"><strong>{score}</strong><span>{record ? '新的个人最高纪录' : '累计积分 · 复活后保留'}</span>{personalBest > 0 && <span className="death-best">个人最高 {personalBest}</span>}<span className="death-life">本条命 · 食物 {life.foods} · 击杀 {life.kills}</span></div>
        <button ref={buttonRef} className="primary-button" disabled={disabled || respawning} onClick={onRespawn}>{respawning ? '正在复活…' : disabled ? '等待连接恢复…' : '再来一次 ↗'}</button>
        <p className="death-hotkey" aria-hidden="true">按 <kbd>Enter</kbd> 快速复活</p>
        <button className="text-button" onClick={onLeave}>返回大厅</button>
      </section>
    </div>
  );
}
