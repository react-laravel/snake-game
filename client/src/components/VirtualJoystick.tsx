import type { JoystickState } from '../types/game';

interface VirtualJoystickProps {
  joystick: JoystickState;
  size: number;
}

export function VirtualJoystick({ joystick, size }: VirtualJoystickProps) {
  if (!joystick.active) {
    return null;
  }

  return (
    <div
      className="joystick-base"
      style={{
        left: joystick.baseX - size / 2,
        top: joystick.baseY - size / 2,
        width: size,
        height: size,
      }}
    >
      <div
        className="joystick-knob"
        style={{
          transform: `translate(calc(-50% + ${joystick.dx}px), calc(-50% + ${joystick.dy}px))`,
        }}
      />
    </div>
  );
}
