// Fog of war (F11): een donkere rechthoek over elke verborgen regio.
// Deze laag ligt boven alles behalve de speler-tokens en de sleep-markering.

import { cellEdge } from '../coords';
import { isCellHidden } from '../fog';
import type { DoorItem, MapData } from '../schema';
import { FOG } from '../tiles/palette';
import { S, svgEl } from './svg';
import { renderDoor } from './walls';

export function renderFog(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  const hidden = map.regions.filter((r) => r.hidden);
  if (!hidden.length) return;

  // Patroon met schuine streepjes, één keer per vakje herhaald.
  const defs = svgEl('defs', {}, g);
  const pattern = svgEl('pattern', {
    id: 'fog-hatch', width: S / 4, height: S / 4, patternUnits: 'userSpaceOnUse',
  }, defs);
  svgEl('rect', { width: S / 4, height: S / 4, fill: FOG.color }, pattern);
  svgEl('path', { d: `M0 ${S / 4}L${S / 4} 0`, stroke: FOG.hatch, 'stroke-width': 2 }, pattern);

  for (const r of hidden) {
    const { c1, r1, c2, r2 } = r.rect;
    svgEl('rect', {
      x: c1 * S,
      y: r1 * S,
      width: (c2 - c1 + 1) * S,
      height: (r2 - r1 + 1) * S,
      fill: 'url(#fog-hatch)',
      class: 'fog',
      'data-region': r.id,
    }, g);
  }

  // Een deur op de rand van de mist zie je van buitenaf wel: die tekenen we nog
  // eens bovenop, zodat je ziet of ze open, dicht of op slot is.
  for (const d of map.doors) if (onFogEdge(map, d)) renderDoor(g, d);
}

function onFogEdge(map: MapData, d: DoorItem): boolean {
  const e = cellEdge(d.cell, d.side);
  const other = { c: d.cell.c - e.nx, r: d.cell.r - e.ny };
  if (other.c < 0 || other.r < 0 || other.c >= map.cols || other.r >= map.rows) return false;
  return isCellHidden(map, d.cell) !== isCellHidden(map, other);
}
