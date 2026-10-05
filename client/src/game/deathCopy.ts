import type { DeathCause } from '../types/game';

export interface DeathCopyInput {
  killerName?: string | null;
  cause?: DeathCause;
  scoringKill?: boolean;
}

export type DeathCopy =
  | { kind: 'kill'; name: string }
  | { kind: 'head-on' }
  | { kind: 'crash'; name: string }
  | { kind: 'collision' };

export function deathCopy(event: DeathCopyInput): DeathCopy {
  const scoring = typeof event.scoringKill === 'boolean' ? event.scoringKill : Boolean(event.killerName);
  if (scoring && event.killerName) return { kind: 'kill', name: event.killerName };
  if (event.cause === 'head-on') return { kind: 'head-on' };
  if (event.killerName) return { kind: 'crash', name: event.killerName };
  return { kind: 'collision' };
}

export function deathReason(event: DeathCopyInput) {
  const copy = deathCopy(event);
  if (copy.kind === 'kill') return `被 ${copy.name} 击杀，下次提前转弯。`;
  if (copy.kind === 'head-on') return '正面相撞，双方都出局了。';
  if (copy.kind === 'crash') return `撞上 ${copy.name}，对方也没能留下。`;
  return '碰撞出局，下次留意墙壁与蛇身。';
}
