import { useEffect, useRef, useState } from 'react';
import type { Dir, JoystickState } from '../types/game';

const IDLE_JOYSTICK: JoystickState = { active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 };
const KEY_DIRECTIONS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
interface UseGameControlsOptions { enabled: boolean; joystickSize: number; onDirectionChange: (direction: Dir) => void; }

export function useGameControls({ enabled, joystickSize, onDirectionChange }: UseGameControlsOptions) {
  const [joystick, setJoystick] = useState<JoystickState>(IDLE_JOYSTICK);
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const reset = () => { touchIdRef.current = null; originRef.current = null; setJoystick(IDLE_JOYSTICK); };
    if (!enabled) { reset(); return; }
    const maxDistance = joystickSize / 2;
    let lastTouchDirection: Dir | null = null;

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key] || KEY_DIRECTIONS[event.key.toLowerCase()];
      if (!direction || event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      event.preventDefault();
      if (!event.repeat) onDirectionChange(direction);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (touchIdRef.current !== null) return;
      for (const touch of Array.from(event.changedTouches)) {
        const target = touch.target;
        if (!(target instanceof Element) || target.closest('[data-no-joystick]') || !target.closest('[data-game-surface]')) continue;
        if (event.cancelable) event.preventDefault();
        touchIdRef.current = touch.identifier;
        originRef.current = { x: touch.clientX, y: touch.clientY };
        lastTouchDirection = null;
        setJoystick({ active: true, dx: 0, dy: 0, baseX: touch.clientX, baseY: touch.clientY });
        break;
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (touchIdRef.current === null) return;
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier !== touchIdRef.current || !originRef.current) continue;
        if (event.cancelable) event.preventDefault();
        const origin = originRef.current;
        let dx = touch.clientX - origin.x;
        let dy = touch.clientY - origin.y;
        const distance = Math.hypot(dx, dy);
        if (distance > maxDistance) { dx *= maxDistance / distance; dy *= maxDistance / distance; }
        setJoystick({ active: true, dx, dy, baseX: origin.x, baseY: origin.y });
        if (distance <= maxDistance * 0.25) { lastTouchDirection = null; continue; }
        const direction: Dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
        if (direction !== lastTouchDirection) { lastTouchDirection = direction; onDirectionChange(direction); }
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (Array.from(event.changedTouches).some((touch) => touch.identifier === touchIdRef.current)) { reset(); lastTouchDirection = null; }
    };
    const onVisibilityChange = () => { if (document.hidden) reset(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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
