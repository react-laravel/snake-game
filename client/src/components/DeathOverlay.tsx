interface DeathOverlayProps {
  onRespawn: () => void;
}

export function DeathOverlay({ onRespawn }: DeathOverlayProps) {
  return (
    <div className="death-overlay" data-no-joystick onClick={onRespawn}>
      <div className="death-icon">X</div>
      <div className="death-title">你已死亡</div>
      <div className="death-hint">点击任意处复活</div>
    </div>
  );
}
