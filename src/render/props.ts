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

import { buildBlockers } from '../movement';
import { propLayout, type PropLayout } from '../props-layout';
import type { MapData, PropItem } from '../schema';
import { PROP, UNKNOWN } from '../tiles/palette';
import { S, svgEl } from './svg';

export function renderProps(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  const blockers = buildBlockers(map);
  for (const p of map.props) renderProp(g, p, propLayout(p, blockers));
}

function renderProp(g: SVGGElement, p: PropItem, l: PropLayout): void {
  const { rot, lw, lh, img, box } = l;
  const el = svgEl('g', {
    transform: `translate(${l.cx} ${l.cy}) rotate(${rot})`,
    class: 'prop',
    'data-prop': p.tile,
  }, g);

  // Afbeelding: eigen bestand, of een passende variant uit Forgotten Adventures, op de plek
  // die propLayout berekende (echte grootte, uitgelijnd op het raster, of tegen de muur).
  if (img) {
    if (img.turn) {
      // Een kwartslag gedraaid om te passen: draai rond het midden van het vak.
      const t = svgEl('g', { transform: `translate(${box.x + box.w / 2} ${box.y + box.h / 2}) rotate(90)` }, el);
      svgEl('image', {
        href: img.url, x: -box.h / 2, y: -box.w / 2, width: box.h, height: box.w, preserveAspectRatio: 'xMidYMid meet',
      }, t);
    } else {
      svgEl('image', {
        href: img.url, x: box.x, y: box.y, width: box.w, height: box.h, preserveAspectRatio: 'xMidYMid meet',
      }, el);
    }
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
