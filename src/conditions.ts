// Condities (F14): Nederlandse namen en wat ze doen met beweging (5e, 2024-regels).
//
// De DM schrijft condities in het Engels ("prone"), zoals in de regels.
// Onbekende condities tonen we gewoon zoals ze geschreven zijn.

import type { TokenItem } from './schema';

export const CONDITION_NL: Record<string, string> = {
  blinded: 'blind',
  charmed: 'betoverd',
  concentrating: 'concentratie',
  concentration: 'concentratie',
  deafened: 'doof',
  exhaustion: 'uitgeput',
  frightened: 'bang',
  grappled: 'vastgegrepen',
  incapacitated: 'uitgeschakeld',
  invisible: 'onzichtbaar',
  paralyzed: 'verlamd',
  petrified: 'versteend',
  poisoned: 'vergiftigd',
  prone: 'liggend',
  restrained: 'in bedwang',
  stunned: 'verdoofd',
  unconscious: 'bewusteloos',
  hidden: 'verstopt',
  dodging: 'ontwijkt',
};

/** Condities waarbij je speed 0 is: je kan niet bewegen. */
export const SPEED_ZERO = new Set(['grappled', 'restrained', 'paralyzed', 'petrified', 'unconscious']);

const norm = (c: string) => c.trim().toLowerCase();

export function conditionLabel(c: string): string {
  return CONDITION_NL[norm(c)] ?? c.trim();
}

export function hasCondition(t: TokenItem, name: string): boolean {
  return (t.conditions ?? []).some((c) => norm(c) === name);
}

/** Liggend: je kruipt, elk vakje kost 1 extra. */
export function isCrawling(t: TokenItem): boolean {
  return hasCondition(t, 'prone');
}

/** De conditie die je speed op 0 zet (de eerste), of undefined. */
export function speedZeroBy(t: TokenItem): string | undefined {
  return (t.conditions ?? []).find((c) => SPEED_ZERO.has(norm(c)));
}

/** Speed na condities: 0 bij bv. vastgegrepen. undefined = onbekend (geen speed in de kaart). */
export function effectiveSpeed(t: TokenItem): number | undefined {
  if (speedZeroBy(t)) return 0;
  return t.speed;
}
