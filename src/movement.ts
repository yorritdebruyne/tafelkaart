// Wat mag een token tijdens het slepen?
//
// 1. Niet door muren, dichte deuren of ramen. Wel door open deuren en bogen.
//    Diagonaal mag alleen als je ook "via de hoek" (eerst opzij, dan vooruit,
//    of omgekeerd) kan gaan: zo glip je niet tussen twee muren door die elkaar
//    in een hoekpunt raken.
// 2. Niet eindigen op een vakje waar al een ander (zichtbaar) token staat.
//    Erdoor lopen mag wel (5e: door een bondgenoot bewegen mag, er stoppen niet).
//    Tokens in de mist tellen niet mee, anders verklapt de app waar ze staan.
//
// De DM kan tokens altijd overal zetten met een patch; deze regels gelden
// alleen voor slepen.

import { type Cell, cellEdge, chebyshev, type EdgeSide } from './coords';
import { isTokenHidden } from './fog';
import type { MapData } from './schema';

type Seg = [number, number, number, number];

export interface Blockers {
  walls: Seg[];
  /** Randen met een dichte deur, deur op slot of raam. */
  closed: Set<string>;
  /** Randen met een open deur of een boog: altijd doorgang, ook als er een muur over loopt. */
  open: Set<string>;
}

/** Sleutel van de rand tussen twee buurvakjes (orthogonaal). */
function edgeKey(x1: number, y1: number, x2: number, y2: number): string {
  return x1 === x2 ? `V:${x1}:${Math.min(y1, y2)}` : `H:${Math.min(x1, x2)}:${y1}`;
}

export function buildBlockers(map: MapData): Blockers {
  const walls: Seg[] = [];
  for (const w of map.walls) {
    for (let i = 1; i < w.points.length; i++) {
      const [x1, y1] = w.points[i - 1];
      const [x2, y2] = w.points[i];
      walls.push([x1, y1, x2, y2]);
    }
  }
  const closed = new Set<string>();
  const open = new Set<string>();
  for (const d of map.doors) {
    const e = cellEdge(d.cell, d.side as EdgeSide);
    const key = edgeKey(e.x1, e.y1, e.x2, e.y2);
    if (d.tile === 'arch' || d.state === 'open') open.add(key);
    else closed.add(key);
  }
  return { walls, closed, open };
}

/** Raken of snijden twee lijnstukken elkaar (ook in een eindpunt)? */
function intersects(a: Seg, b: Seg): boolean {
  const orient = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  const onSeg = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    Math.min(px, qx) <= rx && rx <= Math.max(px, qx) && Math.min(py, qy) <= ry && ry <= Math.max(py, qy);
  const [ax, ay, bx, by] = a;
  const [cx, cy, dx, dy] = b;
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSeg(ax, ay, bx, by, cx, cy)) || (o2 === 0 && onSeg(ax, ay, bx, by, dx, dy))
    || (o3 === 0 && onSeg(cx, cy, dx, dy, ax, ay)) || (o4 === 0 && onSeg(cx, cy, dx, dy, bx, by));
}

/** Eén vakje opzij of vooruit (geen diagonaal), voor één vakje van het token. */
function orthoFree(b: Blockers, from: Cell, to: Cell): boolean {
  // De rand die je oversteekt.
  const x1 = Math.max(from.c, to.c), y1 = Math.max(from.r, to.r);
  const key = from.c !== to.c ? edgeKey(x1, from.r, x1, from.r + 1) : edgeKey(from.c, y1, from.c + 1, y1);
  if (b.open.has(key)) return true;
  if (b.closed.has(key)) return false;
  // Lijn van midden naar midden: raakt die een muur?
  const move: Seg = [from.c + 0.5, from.r + 0.5, to.c + 0.5, to.r + 0.5];
  return !b.walls.some((w) => intersects(move, w));
}

/** Een token van size × size schuift één vakje orthogonaal: check alleen de voorste rij vakjes. */
function blockOrthoFree(b: Blockers, from: Cell, to: Cell, size: number): boolean {
  const dc = to.c - from.c, dr = to.r - from.r;
  for (let i = 0; i < size; i++) {
    const cell: Cell = dc !== 0
      ? { c: dc > 0 ? from.c + size - 1 : from.c, r: from.r + i }
      : { c: from.c + i, r: dr > 0 ? from.r + size - 1 : from.r };
    if (!orthoFree(b, cell, { c: cell.c + dc, r: cell.r + dr })) return false;
  }
  return true;
}

/** Mag een token (linkerbovenhoek `from`) één stap zetten naar een buurvakje `to`? */
export function canStep(b: Blockers, from: Cell, to: Cell, size = 1): boolean {
  const dc = to.c - from.c, dr = to.r - from.r;
  if (chebyshev(from, to) !== 1) return false;
  if (dc === 0 || dr === 0) return blockOrthoFree(b, from, to, size);
  const viaC: Cell = { c: to.c, r: from.r };
  const viaR: Cell = { c: from.c, r: to.r };
  return (blockOrthoFree(b, from, viaC, size) && blockOrthoFree(b, viaC, to, size))
    || (blockOrthoFree(b, from, viaR, size) && blockOrthoFree(b, viaR, to, size));
}

/**
 * De vakjes tussen a en b, stap voor stap (zonder a, met b).
 * Nodig als je snel sleept en de vinger in één keer meerdere vakjes verspringt.
 */
export function stepsBetween(a: Cell, b: Cell): Cell[] {
  const n = chebyshev(a, b);
  const out: Cell[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({ c: Math.round(a.c + ((b.c - a.c) * i) / n), r: Math.round(a.r + ((b.r - a.r) * i) / n) });
  }
  return out;
}

/** Staat er op deze plek (size × size vanaf `cell`) al een ander zichtbaar token? */
export function isOccupied(map: MapData, cell: Cell, size: number, selfId: string): boolean {
  return map.tokens.some((t) => {
    if (t.id === selfId || isTokenHidden(map, t)) return false;
    return cell.c < t.cell.c + t.size && t.cell.c < cell.c + size
      && cell.r < t.cell.r + t.size && t.cell.r < cell.r + size;
  });
}

/**
 * Hoe ver kan het token langs `path` komen zonder op een ander token te eindigen?
 * Geeft de index van het laatste vrije vakje (0 = blijft op de startplek).
 */
export function landingIndex(map: MapData, path: Cell[], size: number, selfId: string): number {
  for (let i = path.length - 1; i > 0; i--) {
    if (!isOccupied(map, path[i], size, selfId)) return i;
  }
  return 0;
}
