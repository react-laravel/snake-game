export const NAME_FONT_SIZE = 11;
export const NAME_PAD_X = 4;
export const NAME_PAD_Y = 2;

export function nameCaption(name: string, self: boolean): string {
  return self ? `${name} · 你` : name;
}

/** Use the drawn width, but never more than the fillText max width. */
export function nameTextWidth(measured: number, maxWidth: number): number {
  if (maxWidth <= 0) return 0;
  return Math.max(0, Math.min(measured, maxWidth));
}

/**
 * A compact plate behind a centered, alphabetic-baseline label so names stay
 * readable on the checkerboard and over light snake bodies.
 */
export function namePlateRect(
  centerX: number,
  baselineY: number,
  textWidth: number,
  fontSize = NAME_FONT_SIZE,
  padX = NAME_PAD_X,
  padY = NAME_PAD_Y,
): { x: number; y: number; w: number; h: number } {
  const width = Math.max(0, textWidth) + padX * 2;
  const ascent = fontSize * 0.8;
  const descent = fontSize * 0.25;
  const height = ascent + descent + padY * 2;
  return { x: centerX - width / 2, y: baselineY - ascent - padY, w: width, h: height };
}
