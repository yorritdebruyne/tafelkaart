// Waar en hoe een prop getekend wordt, en welke vakjes hij echt beslaat.
// Gedeeld door het tekenen (render/props.ts) en het tegenhouden bij slepen (blocking.ts),
// zodat een prop altijd tegenhoudt waar hij te zien is.

import type { Rect } from './coords';
import { type Blockers, canStep } from './movement';
import type { PropItem } from './schema';
import { isWallProp, type PropImage, propImage } from './tiles';

/** 1 vakje = 64 SVG-eenheden (zelfde als render/svg.ts). */
const S = 64;
/** Halve muurdikte: zoveel ruimte laten we tussen de muurlijn en een muur-prop. */
const WALL_GAP = S * 0.08;

/**
 * Aan welke kant van de rechthoek staat over de hele lengte een muur (of dichte deur)?
 * Volgorde bij een hoek: noord, west, oost, zuid. Geeft de rotatie die "boven" naar die muur draait.
 */
export function wallRotation(b: Blockers, rect: Rect): number | null {
  const { c1, r1, c2, r2 } = rect;
  const along = (cells: [number, number, number, number][]) =>
    cells.every(([c, r, dc, dr]) => !canStep(b, { c, r }, { c: c + dc, r: r + dr }));
  const range = (a: number, z: number) => Array.from({ length: z - a + 1 }, (_, i) => a + i);
  if (along(range(c1, c2).map((c) => [c, r1, 0, -1]))) return 0; // noord
  if (along(range(r1, r2).map((r) => [c1, r, -1, 0]))) return 270; // west
  if (along(range(r1, r2).map((r) => [c2, r, 1, 0]))) return 90; // oost
  if (along(range(c1, c2).map((c) => [c, r2, 0, 1]))) return 180; // zuid
  return null;
}

export interface PropLayout {
  /** Midden van de vakjes van de DM, in SVG-eenheden. */
  cx: number;
  cy: number;
  /** Rotatie in graden (van de DM, of naar de muur gedraaid). */
  rot: number;
  /** Naar een muur gedraaid? */
  toWall: boolean;
  /** Breedte en hoogte van de vakjes van de DM vóór het draaien. */
  lw: number;
  lh: number;
  /** De afbeelding, als die er is (anders reserve-tekening). */
  img?: PropImage;
  /** Waar de tekening ligt, vóór het draaien, rond het midden (SVG-eenheden). */
  box: { x: number; y: number; w: number; h: number };
}

export function propLayout(p: PropItem, walls: Blockers): PropLayout {
  const { c1, r1, c2, r2 } = p.rect;
  const w = (c2 - c1 + 1) * S;
  const h = (r2 - r1 + 1) * S;
  const wallRot = p.rot === 0 && isWallProp(p.tile) ? wallRotation(walls, p.rect) : null;
  const rot = wallRot ?? p.rot;
  const quarter = rot % 180 === 90;
  const lw = quarter ? h : w;
  const lh = quarter ? w : h;
  const layout: PropLayout = {
    cx: c1 * S + w / 2, cy: r1 * S + h / 2, rot, toWall: wallRot !== null, lw, lh,
    box: { x: -lw / 2, y: -lh / 2, w: lw, h: lh },
  };
  // De "dobbelsteen" is de plek op de kaart, zodat de keuze vast blijft.
  const img = propImage(p.tile, lw / S, lh / S, `${p.tile}|${c1},${r1}`);
  if (!img) return layout;
  layout.img = img;
  const W = img.w * S;
  const H = img.h * S;
  let x = -W / 2;
  let y = -H / 2;
  // Groter dan de vakjes van de DM: op echte grootte, uitgelijnd op het raster.
  // Het teveel gaat zoveel mogelijk naar rechts en onder (zoals bij tokens);
  // bij 2 of meer vakjes teveel komt de helft links/boven.
  // Een trog van 2×1 op C7 ligt zo op C7:D7, een boom van 3×3 op C3 op B2:D4.
  if (img.overflow) {
    if (W > lw) x = -lw / 2 - Math.floor(Math.round((W - lw) / S) / 2) * S;
    if (H > lh) y = -lh / 2 - Math.floor(Math.round((H - lh) / S) / 2) * S;
  }
  // Tegen de muur: schuif tot de bovenkant van de tekening tegen de muurlijn ligt.
  if (layout.toWall && !img.turn) {
    const top = y + (img.box ? img.box[1] : 0) * H;
    y += -lh / 2 + WALL_GAP - top;
  }
  layout.box = { x, y, w: W, h: H };
  return layout;
}

/** Alle vakjes die de tekening van een prop beslaat (na draaien), als [c, r]. */
export function layoutCells(l: PropLayout): [number, number][] {
  const a = (l.rot * Math.PI) / 180;
  const cos = Math.round(Math.cos(a) * 1e6) / 1e6;
  const sin = Math.round(Math.sin(a) * 1e6) / 1e6;
  const pts = [[l.box.x, l.box.y], [l.box.x + l.box.w, l.box.y], [l.box.x, l.box.y + l.box.h], [l.box.x + l.box.w, l.box.y + l.box.h]]
    .map(([x, y]) => [l.cx + x * cos - y * sin, l.cy + x * sin + y * cos]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const eps = 0.5;
  const c1 = Math.floor((Math.min(...xs) + eps) / S), c2 = Math.ceil((Math.max(...xs) - eps) / S) - 1;
  const r1 = Math.floor((Math.min(...ys) + eps) / S), r2 = Math.ceil((Math.max(...ys) - eps) / S) - 1;
  const out: [number, number][] = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push([c, r]);
  return out;
}

/** Midden van de tekening van een prop (na draaien), in SVG-eenheden. */
export function layoutCenter(l: PropLayout): { x: number; y: number } {
  const a = (l.rot * Math.PI) / 180;
  const mx = l.box.x + l.box.w / 2, my = l.box.y + l.box.h / 2;
  return { x: l.cx + mx * Math.cos(a) - my * Math.sin(a), y: l.cy + mx * Math.sin(a) + my * Math.cos(a) };
}
