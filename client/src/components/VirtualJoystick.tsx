import { useLayoutEffect, useRef, type RefObject } from 'react';

export interface JoystickVisual {
  base: HTMLDivElement;
  knob: HTMLDivElement;
}

interface VirtualJoystickProps {
  active: boolean;
  size: number;
  visualRef: RefObject<JoystickVisual | null>;
  onReady: () => void;
}

export function VirtualJoystick({ active, size, visualRef, onReady }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!active || !baseRef.current || !knobRef.current) return;
    visualRef.current = { base: baseRef.current, knob: knobRef.current };
    onReady();
    return () => {
      if (visualRef.current?.base === baseRef.current) visualRef.current = null;
    };
  }, [active, onReady, visualRef]);

  if (!active) return null;

  return (
    <div ref={baseRef} className="joystick-base" style={{ width: size, height: size }} aria-hidden="true">
      <div ref={knobRef} className="joystick-knob" />
    </div>
  );
}
