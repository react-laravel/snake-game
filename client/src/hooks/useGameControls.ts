import { useCallback, useEffect, useRef, useState } from 'react';
import type { JoystickVisual } from '../components/VirtualJoystick';
import type { Dir } from '../types/game';

const KEY_DIRECTIONS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
interface UseGameControlsOptions { enabled: boolean; joystickSize: number; onDirectionChange: (direction: Dir) => void; }

export function useGameControls({ enabled, joystickSize, onDirectionChange }: UseGameControlsOptions) {
  const [active, setActive] = useState(false);
  const visualRef = useRef<JoystickVisual | null>(null);
  const poseRef = useRef({ dx: 0, dy: 0, baseX: 0, baseY: 0 });
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);

  const syncVisual = useCallback(() => {
    const node = visualRef.current;
    if (!node) return;
    const { dx, dy, baseX, baseY } = poseRef.current;
    node.base.style.left = `${baseX - joystickSize / 2}px`;
    node.base.style.top = `${baseY - joystickSize / 2}px`;
    node.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }, [joystickSize]);

  useEffect(() => {
    const reset = () => {
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
      touchIdRef.current = null;
      originRef.current = null;
      setActive(false);
    };
    if (!enabled) { reset(); return; }
    const maxDistance = joystickSize / 2;
    let lastTouchDirection: Dir | null = null;

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key] || KEY_DIRECTIONS[event.key.toLowerCase()];
      if (!direction || event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      event.preventDefault();
      if (!event.repeat) onDirectionChange(direction);
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
        poseRef.current = { dx, dy, baseX: origin.x, baseY: origin.y };
        syncVisual();
        if (distance <= maxDistance * 0.25) { lastTouchDirection = null; continue; }
        const direction: Dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
        if (direction !== lastTouchDirection) { lastTouchDirection = direction; onDirectionChange(direction); }
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (Array.from(event.changedTouches).some((touch) => touch.identifier === touchIdRef.current)) { reset(); lastTouchDirection = null; }
    };
    const onTouchStart = (event: Event) => {
      if (touchIdRef.current !== null || !(event instanceof TouchEvent)) return;
      for (const touch of Array.from(event.changedTouches)) {
        const target = touch.target;
        if (!(target instanceof Element) || target.closest('[data-no-joystick]') || !target.closest('[data-game-surface]')) continue;
        if (event.cancelable) event.preventDefault();
        touchIdRef.current = touch.identifier;
        originRef.current = { x: touch.clientX, y: touch.clientY };
        lastTouchDirection = null;
        poseRef.current = { dx: 0, dy: 0, baseX: touch.clientX, baseY: touch.clientY };
        setActive(true);
        const end = (endEvent: TouchEvent) => onTouchEnd(endEvent);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', end);
        document.addEventListener('touchcancel', end);
        gestureCleanupRef.current = () => {
          document.removeEventListener('touchmove', onTouchMove);
          document.removeEventListener('touchend', end);
          document.removeEventListener('touchcancel', end);
        };
        break;
      }
    };
    const onVisibilityChange = () => { if (document.hidden) reset(); };
    const surface = document.querySelector('[data-game-surface]');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onVisibilityChange);
    surface?.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      surface?.removeEventListener('touchstart', onTouchStart);
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
      touchIdRef.current = null;
      originRef.current = null;
    };
  }, [enabled, joystickSize, onDirectionChange, syncVisual]);

  return { active, visualRef, syncVisual };
}
