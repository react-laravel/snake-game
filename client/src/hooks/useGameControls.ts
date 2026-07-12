import { useEffect, useRef, useState } from 'react';
import type { Dir, JoystickState } from '../types/game';

const IDLE_JOYSTICK: JoystickState = {
  active: false,
  dx: 0,
  dy: 0,
  baseX: 0,
  baseY: 0,
};

const KEY_DIRECTIONS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

interface UseGameControlsOptions {
  enabled: boolean;
  joystickSize: number;
  onDirectionChange: (direction: Dir) => void;
}

export function useGameControls({ enabled, joystickSize, onDirectionChange }: UseGameControlsOptions) {
  const [joystick, setJoystick] = useState<JoystickState>(IDLE_JOYSTICK);
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key];
      if (!direction) return;
      event.preventDefault();
      onDirectionChange(direction);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onDirectionChange]);

  useEffect(() => {
    if (!enabled) {
      setJoystick(IDLE_JOYSTICK);
      return;
    }

    const maxDistance = joystickSize / 2;

    const onTouchStart = (event: TouchEvent) => {
      if (touchIdRef.current !== null) return;

      for (const touch of Array.from(event.changedTouches)) {
        const target = touch.target as HTMLElement;
        if (target.closest('[data-no-joystick]')) continue;

        event.preventDefault();
        touchIdRef.current = touch.identifier;
        originRef.current = { x: touch.clientX, y: touch.clientY };
        setJoystick({ active: true, dx: 0, dy: 0, baseX: touch.clientX, baseY: touch.clientY });
        break;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (touchIdRef.current === null) return;
      event.preventDefault();

      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier !== touchIdRef.current) continue;

        const origin = originRef.current;
        if (!origin) continue;

        let dx = touch.clientX - origin.x;
        let dy = touch.clientY - origin.y;
        const distance = Math.hypot(dx, dy);

        if (distance > maxDistance) {
          dx = (dx / distance) * maxDistance;
          dy = (dy / distance) * maxDistance;
        }

        setJoystick({ active: true, dx, dy, baseX: origin.x, baseY: origin.y });
        if (distance <= maxDistance * 0.3) continue;

        if (Math.abs(dx) > Math.abs(dy)) {
          onDirectionChange(dx > 0 ? 'right' : 'left');
        } else {
          onDirectionChange(dy > 0 ? 'down' : 'up');
        }
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier !== touchIdRef.current) continue;
        touchIdRef.current = null;
        originRef.current = null;
        setJoystick(IDLE_JOYSTICK);
        break;
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
      touchIdRef.current = null;
      originRef.current = null;
    };
  }, [enabled, joystickSize, onDirectionChange]);

  return joystick;
}
