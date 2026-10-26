// Spelregels als code (D&D 5e, 2024-regels).

import { effectiveSpeed, isCrawling } from './conditions';
import { type Cell, chebyshev, formatCell, sameCell } from './coords';
import { isTokenHidden } from './fog';
import { cellKey, isOccupied } from './movement';
import type { MapData, TokenItem } from './schema';
import { terrainInfo } from './terrain';

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

/**
 * Wat kost het om (met de linkerbovenhoek) op `to` te stappen? 1 per vakje, plus 1 voor
 * elk van: moeilijk terrein (ook: door de ruimte van een ander wezen), klimmen, kruipen.
 * Zie terrain.ts.
 */
export function stepExtra(map: MapData, token: TokenItem, to: Cell): number {
  const info = terrainInfo(map);
  const keys: string[] = [];
  for (let r = 0; r < token.size; r++) for (let c = 0; c < token.size; c++) keys.push(cellKey(to.c + c, to.r + r));
  let extra = 0;
  if (keys.some((k) => info.difficult.has(k)) || isOccupied(map, to, token.size, token.id)) extra++;
  if (keys.some((k) => info.climb.has(k) || info.enter.has(k))) extra++; // klimmen of erin kruipen
  if (isCrawling(token)) extra++;
  return extra;
}

/** Gebruikte beweging langs een weg, met moeilijk terrein, klimmen en kruipen. */
export function pathCost(map: MapData, token: TokenItem, path: Cell[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = chebyshev(path[i - 1], path[i]);
    total += d * (1 + stepExtra(map, token, path[i]));
  }
  return total;
}

/** Boven de speed? Condities tellen mee (vastgegrepen = speed 0). */
export function isOverSpeed(token: TokenItem, used: number): boolean {
  const speed = effectiveSpeed(token);
  return speed !== undefined && used > speed;
}

/** Twee tokens naast elkaar (ook schuin), rekening houdend met hun grootte? */
function adjacent(a: Cell, aSize: number, b: TokenItem): boolean {
  const dx = Math.max(0, b.cell.c - (a.c + aSize - 1), a.c - (b.cell.c + b.size - 1));
  const dy = Math.max(0, b.cell.r - (a.r + aSize - 1), a.r - (b.cell.r + b.size - 1));
  return Math.max(dx, dy) <= 1;
}

/**
 * Welke zichtbare vijanden verlaat de speler langs deze weg (eerst ernaast, daarna niet meer)?
 * Dan mag die vijand een opportunity attack doen (tenzij je Disengage nam: dat weet de DM).
 * We rekenen met een bereik van 1 vakje.
 */
export function leftReach(map: MapData, token: TokenItem, path: Cell[]): string[] {
  const out: string[] = [];
  const enemies = map.tokens.filter((t) => t.side === 'enemy' && t.id !== token.id && !isTokenHidden(map, t));
  for (let i = 1; i < path.length; i++) {
    for (const e of enemies) {
      if (out.includes(e.name)) continue;
      if (adjacent(path[i - 1], token.size, e) && !adjacent(path[i], token.size, e)) out.push(e.name);
    }
  }
  return out;
}

/** "Posities: Akmenos: E9, Amara: E7, T3: E8" — spelers eerst, daarna de rest. */
export function positionsText(
  tokens: TokenItem[],
  doorNotes: Record<string, string> = {},
  inside: (t: TokenItem) => string | undefined = () => undefined,
): string {
  const order = { player: 0, npc: 1, enemy: 2 } as const;
  const sorted = [...tokens].sort((a, b) => order[a.side] - order[b.side]);
  const doors = Object.entries(doorNotes).map(([id, s]) => `deur ${id} ${s === 'open' ? 'open' : 'dicht'}`);
  const extra = doors.length ? ` (${doors.join(', ')})` : '';
  const pos = (t: TokenItem) => {
    const where = inside(t);
    return `${t.name}: ${formatCell(t.cell)}${where ? ` (in ${where})` : ''}`;
  };
  return `Posities: ${sorted.map(pos).join(', ')}${extra}`;
}
