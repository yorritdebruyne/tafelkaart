// Spelregels als code (D&D 5e, 2024-regels).

import { type Cell, chebyshev, formatCell, sameCell } from './coords';
import type { TokenItem } from './schema';

export const METERS_PER_SQUARE = 1.5;

/**
 * Voeg een vakje toe aan de afgelegde weg tijdens het slepen.
 * Kom je terug op een vakje waar je al was, dan wordt de weg tot daar ingekort:
 * terugslepen "ontdoet" dus je beweging.
 */
export function extendPath(path: Cell[], next: Cell): Cell[] {
  const idx = path.findIndex((p) => sameCell(p, next));
  if (idx >= 0) return path.slice(0, idx + 1);
  return [...path, next];
}

/** Lengte van een weg in vakjes. Diagonaal = 1 vakje (2024-regels). */
export function pathLength(path: Cell[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += chebyshev(path[i - 1], path[i]);
  return total;
}

export function squaresToMeters(squares: number): string {
  return `${String(squares * METERS_PER_SQUARE).replace('.', ',')} m`;
}

export function isOverSpeed(token: TokenItem, used: number): boolean {
  return token.speed !== undefined && used > token.speed;
}

/** "Posities: Akmenos: E9, Amara: E7, T3: E8" — spelers eerst, daarna de rest. */
export function positionsText(tokens: TokenItem[]): string {
  const order = { player: 0, npc: 1, enemy: 2 } as const;
  const sorted = [...tokens].sort((a, b) => order[a.side] - order[b.side]);
  return `Posities: ${sorted.map((t) => `${t.name}: ${formatCell(t.cell)}`).join(', ')}`;
}
