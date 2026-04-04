import type { FormEvent } from 'react';

interface JoinScreenProps {
  name: string;
  onNameChange: (value: string) => void;
  onJoin: (event: FormEvent) => void;
}

export function JoinScreen({ name, onNameChange, onJoin }: JoinScreenProps) {
  return (
    <div className="join-screen">
      <div className="join-card" data-no-joystick>
        <h1 className="join-title">Snake Arena</h1>
        <p className="join-subtitle">输入昵称后加入多人对局</p>
        <form className="join-form" onSubmit={onJoin}>
          <input
            className="join-input"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="你的名字"
            maxLength={20}
          />
          <button className="join-button" type="submit">
            进入
          </button>
        </form>
        <p className="join-hint">方向键 / WASD 控制 · 手机用左侧虚拟摇杆</p>
      </div>
    </div>
  );
}
