// Props (F10): meubels, bomen, kisten, ... boven de vloer, onder de muren.
//
// Heeft een tegel een afbeelding in src/tiles/props/, dan tekenen we die.
// Anders een reserve-tekening: een gekleurd blokje met de naam en een
// streepje aan de bovenkant, zodat je de rotatie ziet.
//
// Rotatie: we tekenen de prop rond het midden van zijn vakje(s). Bij 90° of
// 270° wisselen breedte en hoogte, zodat een prop van 2×1 vakjes na draaien
// nog altijd netjes op zijn 2×1 (of 1×2) vakjes ligt.

import type { MapData, PropItem } from '../schema';
import { tileImage } from '../tiles';
import { PROP, UNKNOWN } from '../tiles/palette';
import { S, svgEl } from './svg';

export function renderProps(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  for (const p of map.props) renderProp(g, p);
}

function renderProp(g: SVGGElement, p: PropItem): void {
  const { c1, r1, c2, r2 } = p.rect;
  const w = (c2 - c1 + 1) * S;
  const h = (r2 - r1 + 1) * S;
  const quarter = p.rot % 180 === 90;
  // Afmetingen "voor het draaien": bij een kwartslag omgewisseld.
  const lw = quarter ? h : w;
  const lh = quarter ? w : h;
  const el = svgEl('g', {
    transform: `translate(${c1 * S + w / 2} ${r1 * S + h / 2}) rotate(${p.rot})`,
    class: 'prop',
    'data-prop': p.tile,
  }, g);

  const url = tileImage('props', p.tile);
  if (url) {
    // Uitgerekt over alle vakjes van de prop (preserveAspectRatio none).
    svgEl('image', { href: url, x: -lw / 2, y: -lh / 2, width: lw, height: lh, preserveAspectRatio: 'none' }, el);
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
    transform: `rotate(${-p.rot})`, // de naam blijft rechtop leesbaar
    class: 'prop-label',
  }, el);
  label.textContent = p.tile;
}
