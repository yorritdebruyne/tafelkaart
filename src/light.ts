// Licht (F13): waar staan de lichtbronnen, en hoe ver schijnt elk licht?
//
// Bronnen:
//   1. `lights` van de DM;
//   2. props die vanzelf licht geven (kaars, lantaarn, vuurkorf, kampvuur, haard),
//      tenzij de DM zelf al een licht op die prop zette (dan wint de DM).
// Bronnen in de mist schijnen niet (anders verklapt de gloed wat er staat).
//
// Licht stopt aan muren en dichte deuren, niet aan ramen en bogen.
// Hoe: vanuit de bron schieten we "stralen" in alle richtingen, en naar elk hoekpunt
// van een muur in de buurt (net ervoor en erna). Elke straal stopt bij de eerste muur
// die hij raakt. De eindpunten samen vormen een veelhoek: alles wat de bron "ziet".
// Dat heet een visibility polygon; zo doen veel 2D-spellen het ook.
//
// Alles in vakjes (1 = één vakje), het tekenen rekent om naar SVG-eenheden.

import { cellEdge } from './coords';
import { isCellHidden } from './fog';
import { buildBlockers } from './movement';
import { layoutCells, layoutCenter, propLayout } from './props-layout';
import type { MapData } from './schema';
import { LIGHT, PROP_LIGHTS } from './tiles/palette';

export type Seg = [number, number, number, number];

export interface LightSource {
  /** Midden van de bron, in vakjes. */
  x: number;
  y: number;
  /** Heldere straal; het licht dooft uit tot 2 × deze straal. */
  radius: number;
  color: string;
  fromProp: boolean;
}

/** Instelling van de licht-knop: auto = donker zodra de DM lichtbronnen opgeeft. */
export type LightMode = 'auto' | 'aan' | 'uit';

export function isDark(map: MapData, mode: LightMode): boolean {
  return mode === 'aan' || (mode === 'auto' && map.lights.length > 0);
}

export function lightSources(map: MapData): LightSource[] {
  const out: LightSource[] = [];
  const dmCells = new Set<string>();
  for (const l of map.lights) {
    dmCells.add(`${l.cell.c},${l.cell.r}`);
    if (isCellHidden(map, l.cell)) continue;
    out.push({ x: l.cell.c + 0.5, y: l.cell.r + 0.5, radius: l.radius, color: l.color, fromProp: false });
  }
  const walls = buildBlockers(map);
  for (const p of map.props) {
    const radius = PROP_LIGHTS[p.tile];
    if (!radius) continue;
    const l = propLayout(p, walls);
    const cells = layoutCells(l);
    if (cells.some(([c, r]) => dmCells.has(`${c},${r}`))) continue;
    const mid = layoutCenter(l);
    const x = mid.x / 64, y = mid.y / 64;
    if (isCellHidden(map, { c: Math.floor(x), r: Math.floor(y) })) continue;
    out.push({ x, y, radius, color: LIGHT.propColor, fromProp: true });
  }
  return out;
}

/** Lijnstukken die licht tegenhouden: muren, dichte deuren (geen ramen of bogen) en de rand van de kaart. */
export function lightBlockers(map: MapData): Seg[] {
  // De rand van de kaart houdt ook licht tegen: anders schijnt de gloed over de marge.
  const { cols: W, rows: H } = map;
  const segs: Seg[] = [[0, 0, W, 0], [W, 0, W, H], [0, H, W, H], [0, 0, 0, H]];
  const openings = new Set<string>();
  for (const d of map.doors) {
    const e = cellEdge(d.cell, d.side);
    const seg: Seg = [e.x1, e.y1, e.x2, e.y2];
    if (d.tile === 'window' || d.tile === 'arch' || d.state === 'open') openings.add(seg.join(','));
    else segs.push(seg);
  }
  for (const w of map.walls) {
    for (let i = 1; i < w.points.length; i++) {
      const [x1, y1] = w.points[i - 1];
      const [x2, y2] = w.points[i];
      // Een muur die over een open deur of raam loopt (DM liet geen opening): knip dat stuk eruit.
      for (const s of splitUnit([x1, y1, x2, y2])) if (!openings.has(s.join(','))) segs.push(s);
    }
  }
  return segs;
}

/** Een recht muurstuk op het raster in stukjes van één vakje (zo kunnen we deuren eruit knippen). */
function splitUnit(s: Seg): Seg[] {
  const [x1, y1, x2, y2] = s;
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  const straight = x1 === x2 || y1 === y2;
  if (!straight || n <= 1 || !Number.isInteger(n)) return [s];
  const dx = (x2 - x1) / n, dy = (y2 - y1) / n;
  const out: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const a = [x1 + dx * i, y1 + dy * i], b = [x1 + dx * (i + 1), y1 + dy * (i + 1)];
    // Zelfde volgorde als cellEdge (van links/boven naar rechts/onder).
    out.push(a[0] < b[0] || a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]);
  }
  return out;
}

/** Afstand langs de straal (ox,oy)+t·(dx,dy) tot het lijnstuk, of Infinity. */
function rayHit(ox: number, oy: number, dx: number, dy: number, s: Seg): number {
  const [x1, y1, x2, y2] = s;
  const ex = x2 - x1, ey = y2 - y1;
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-12) return Infinity;
  const t = ((x1 - ox) * ey - (y1 - oy) * ex) / den;
  const u = ((x1 - ox) * dy - (y1 - oy) * dx) / den;
  return t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity;
}

/**
 * Veelhoek van alles wat licht vanuit (x, y) kan bereiken binnen `reach` vakjes.
 * Zonder muren in de buurt: gewoon een cirkel (als veelhoek).
 */
export function visibilityPolygon(x: number, y: number, reach: number, segs: Seg[]): [number, number][] {
  // Net naast het midden: zo valt een straal nooit precies op een hoekpunt.
  const ox = x + 1e-4, oy = y + 1.3e-4;
  const near = segs.filter(([x1, y1, x2, y2]) =>
    Math.min(x1, x2) <= ox + reach && Math.max(x1, x2) >= ox - reach
    && Math.min(y1, y2) <= oy + reach && Math.max(y1, y2) >= oy - reach);
  const angles: number[] = [];
  const RING = 48;
  for (let i = 0; i < RING; i++) angles.push((i / RING) * Math.PI * 2 - Math.PI);
  for (const [x1, y1, x2, y2] of near) {
    for (const [px, py] of [[x1, y1], [x2, y2]]) {
      if (Math.hypot(px - ox, py - oy) > reach * 1.5) continue;
      const a = Math.atan2(py - oy, px - ox);
      angles.push(a - 1e-4, a, a + 1e-4);
    }
  }
  angles.sort((a, b) => a - b);
  const pts: [number, number][] = [];
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let t = reach;
    for (const s of near) t = Math.min(t, rayHit(ox, oy, dx, dy, s));
    pts.push([ox + dx * t, oy + dy * t]);
  }
  return pts;
}
