/**
 * Last snake standing only counts after the arena has had at least three
 * living players. A one- or two-person lobby is not a victory.
 */
export function isSoleSurvivor(input: {
  alive: boolean;
  livingCount: number;
  peakLiving: number;
}): boolean {
  return input.alive && input.livingCount === 1 && input.peakLiving >= 3;
}

export function soleSurvivorId(
  players: Array<{ id: string; alive: boolean }>,
  peakLiving: number,
): string | null {
  if (peakLiving < 3) return null;
  const living = players.filter((player) => player.alive);
  return living.length === 1 ? living[0].id : null;
}

export function soleSurvivorLabel(sole: boolean): string {
  return sole ? '独活' : '';
}
