// Props (F10): meubels, bomen, kisten, ... boven de vloer, onder de muren.
//
// Heeft een tegel een afbeelding in src/tiles/props/, dan tekenen we die.
// Anders een reserve-tekening: een gekleurd blokje met de naam en een
// streepje aan de bovenkant, zodat je de rotatie ziet.
//
// Afbeeldingen worden nooit vervormd: ze passen in de vakjes met behoud van verhouding.
//
// Rotatie: we tekenen de prop rond het midden van zijn vakje(s). Bij 90° of
// 270° wisselen breedte en hoogte, zodat een prop van 2×1 vakjes na draaien
// nog altijd netjes op zijn 2×1 (of 1×2) vakjes ligt.
//
// Muur-props (ladder, boekenkast, kast, haard, wapenrek): staat er een muur naast
// en geeft de DM geen "rot", dan draaien we de prop naar die muur en schuiven we de
// tekening ertegen. "Boven" (noord) in de afbeelding is de kant die tegen de muur komt.

import type { Rect } from '../coords';
import { type Blockers, buildBlockers, canStep } from '../movement';
import type { MapData, PropItem } from '../schema';
import { isWallProp, propImage } from '../tiles';
import { PROP, UNKNOWN } from '../tiles/palette';
import { S, svgEl } from './svg';

/** Halve muurdikte: zoveel ruimte laten we tussen de muurlijn en de prop. */
const WALL_GAP = S * 0.08;

export function renderProps(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  const blockers = buildBlockers(map);
  for (const p of map.props) renderProp(g, p, blockers);
}

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

function renderProp(g: SVGGElement, p: PropItem, blockers: Blockers): void {
  const { c1, r1, c2, r2 } = p.rect;
  const w = (c2 - c1 + 1) * S;
  const h = (r2 - r1 + 1) * S;
  const toWall = p.rot === 0 && isWallProp(p.tile) ? wallRotation(blockers, p.rect) : null;
  const rot = toWall ?? p.rot;
  const quarter = rot % 180 === 90;
  // Afmetingen "voor het draaien": bij een kwartslag omgewisseld.
  const lw = quarter ? h : w;
  const lh = quarter ? w : h;
  const el = svgEl('g', {
    transform: `translate(${c1 * S + w / 2} ${r1 * S + h / 2}) rotate(${rot})`,
    class: 'prop',
    'data-prop': p.tile,
  }, g);

  // Afbeelding: eigen bestand, of een passende variant uit Forgotten Adventures.
  // De "dobbelsteen" is de plek op de kaart, zodat de keuze vast blijft.
  const img = propImage(p.tile, lw / S, lh / S, `${p.tile}|${c1},${r1}`);
  if (img) {
    // In het midden, met behoud van verhouding ("meet"). Een FA-afbeelding heeft
    // haar echte grootte (bv. 2×1 vakjes) en draait zo nodig een kwartslag om te passen.
    const iw = img.w * S;
    const ih = img.h * S;
    const target = img.turn ? svgEl('g', { transform: 'rotate(90)' }, el) : el;
    const dw = img.turn ? ih : iw;
    const dh = img.turn ? iw : ih;
    // Groter dan de vakjes van de DM: op echte grootte, uitgelijnd op het raster.
    // Het teveel gaat zoveel mogelijk naar rechts en onder (zoals bij tokens: het vakje
    // is de linkerbovenhoek); bij 2 of meer vakjes teveel komt de helft links/boven.
    // Een trog van 2×1 op C7 ligt zo op C7:D7, een boom van 3×3 op C3 op B2:D4.
    let x = -dw / 2;
    let y = -dh / 2;
    if (img.overflow) {
      const lwT = img.turn ? lh : lw; // rechthoek in de assen van de (gedraaide) afbeelding
      const lhT = img.turn ? lw : lh;
      if (dw > lwT) x = -lwT / 2 - Math.floor(Math.round((dw - lwT) / S) / 2) * S;
      if (dh > lhT) y = -lhT / 2 - Math.floor(Math.round((dh - lhT) / S) / 2) * S;
    }
    // Tegen de muur: schuif tot de bovenkant van de tekening tegen de muurlijn ligt.
    if (toWall !== null && !img.turn) {
      const top = y + (img.box ? img.box[1] : 0) * dh;
      y += -lh / 2 + WALL_GAP - top;
    }
    svgEl('image', {
      href: img.url, x, y, width: dw, height: dh, preserveAspectRatio: 'xMidYMid meet',
    }, target);
    return;
  }

  // Reserve-tekening.
  const color = PROP[p.tile] ?? UNKNOWN;
  const inset = S * 0.1;
  svgEl('rect', {
    x: -lw / 2 + inset, y: -lh / 2 + inset, width: lw - 2 * inset, height: lh - 2 * inset,
    rx: S * 0.12, fill: color, class: `prop-placeholder${PROP[p.tile] ? '' : ' unknown'}`,
  }, el);
  // Streepje = "boven" van de tegel, draait mee.
  svgEl('rect', { x: -S * 0.15, y: -lh / 2 + inset, width: S * 0.3, height: S * 0.07, class: 'prop-top' }, el);
  const label = svgEl('text', {
    x: 0, y: 0,
    'font-size': Math.min(S * 0.22, ((lw - 2 * inset) * 0.95) / Math.max(1, p.tile.length * 0.6)),
    transform: `rotate(${-rot})`, // de naam blijft rechtop leesbaar
    class: 'prop-label',
  }, el);
  label.textContent = p.tile;
}
