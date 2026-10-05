import { useEffect, useRef } from 'react';

interface DeathOverlayProps {
  score: number;
  reason: string;
  disabled: boolean;
  respawning: boolean;
  onRespawn: () => void;
  onLeave: () => void;
}

export function DeathOverlay({ score, reason, disabled, respawning, onRespawn, onLeave }: DeathOverlayProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (buttonRef.current && !buttonRef.current.disabled) buttonRef.current.focus();
    else cardRef.current?.focus();
  }, [disabled, respawning]);

  return (
    <div className="death-overlay" data-no-joystick>
      <section ref={cardRef} className="death-card" role="dialog" tabIndex={-1} aria-labelledby="death-title" aria-describedby="death-reason">
        <div className="death-icon" aria-hidden="true">×</div><span className="eyebrow">ROUND OVER</span>
        <h2 id="death-title">这次就到这里。</h2><p id="death-reason">{reason}</p>
        <div className="death-score"><strong>{score}</strong><span>累计积分 · 复活后保留</span></div>
        <button ref={buttonRef} className="primary-button" disabled={disabled || respawning} onClick={onRespawn}>{respawning ? '正在复活…' : disabled ? '等待连接恢复…' : '再来一次 ↗'}</button>
        <button className="text-button" onClick={onLeave}>返回大厅</button>
      </section>
    </div>
  );
}
