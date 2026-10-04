import type { FormEvent } from 'react';

interface JoinScreenProps {
  name: string;
  busy: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onJoin: (event: FormEvent) => void;
}

export function JoinScreen({ name, busy, error, onNameChange, onJoin }: JoinScreenProps) {
  return (
    <main className="join-screen">
      <div className="lobby-header"><span className="brand-mark" aria-hidden="true">S</span><span>SNAKE / ARENA</span><span className="lobby-tag">多人在线对战</span></div>
      <section className="join-card" aria-labelledby="join-title">
        <div className="join-copy">
          <span className="eyebrow">经典玩法 · 一起开局</span>
          <h1 id="join-title" className="join-title">小小贪吃蛇。<br /><span>大大的竞技场。</span></h1>
          <p className="join-subtitle">吃掉食物，慢慢变长。<br />躲开碰撞，留在场上的每一秒都算数。</p>
          <form className="join-form" onSubmit={onJoin}>
            <label htmlFor="player-name">给你的蛇起个名字</label>
            <div className="join-fields">
              <input id="player-name" className="join-input" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="输入昵称" maxLength={20} autoComplete="nickname" disabled={busy} aria-describedby={error ? 'join-error' : 'join-hint'} autoFocus />
              <button id="start-btn" className="primary-button join-button" type="submit" disabled={busy || !name.trim()}>{busy ? '正在连接…' : '进入竞技场'}<span aria-hidden="true"> ↗</span></button>
            </div>
            {error && <p id="join-error" className="inline-error" role="alert">{error}</p>}
          </form>
          <p id="join-hint" className="join-hint">无需注册，输入昵称即可开始</p>
        </div>
        <div className="arena-preview" aria-hidden="true">
          <div className="preview-heading"><span>THE ARENA</span><span>60 × 40</span></div>
          <svg viewBox="0 0 360 300" className="preview-art">
            <defs><pattern id="preview-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#333" strokeWidth="1" /></pattern></defs>
            <rect x="12" y="12" width="336" height="276" rx="6" fill="url(#preview-grid)" stroke="#4c4c4c" />
            <path d="M84 228 V156 H180 V84 H252" stroke="#444" strokeWidth="18" fill="none" strokeLinejoin="round" />
            <path d="M84 228 V156 H180 V84 H252" stroke="#aaa" strokeWidth="12" fill="none" strokeLinejoin="round" strokeDasharray="10 3" />
            <rect x="242" y="74" width="20" height="20" rx="4" fill="#f3f3f3" /><circle cx="256" cy="79" r="2" fill="#222" /><circle cx="256" cy="89" r="2" fill="#222" />
            <circle cx="300" cy="84" r="6" fill="#eee" /><circle cx="60" cy="60" r="5" fill="#777" /><circle cx="276" cy="228" r="5" fill="#aaa" />
            <path d="M252 252 H204 V204 H156" stroke="#555" strokeWidth="12" fill="none" strokeLinejoin="round" strokeDasharray="10 3" />
          </svg>
          <div className="preview-caption"><span className="status-dot" /> 下一场，等你加入</div>
        </div>
      </section>
      <div className="lobby-rules">
        <div><span className="rule-number">01</span><div><strong>找到你的方向</strong><p><kbd>WASD</kbd> 或方向键 · 手机拖动摇杆</p></div></div>
        <div><span className="rule-number">02</span><div><strong>活着就有分</strong><p>食物 +10 · 存活每秒 +1 · 击杀 +100</p></div></div>
        <div><span className="rule-number">03</span><div><strong>再来一局</strong><p>避开墙壁与蛇身 · 出局后可保留积分复活</p></div></div>
      </div>
      <footer className="lobby-footer">简单上手，认真较量。<span>GOOD LUCK & HAVE FUN</span></footer>
    </main>
  );
}
