// Fog of war (F11): donkere mist over elke verborgen regio.
// Deze laag ligt boven alles behalve de speler-tokens en de sleep-markering.
//
// Opbouw per regio (geen SVG-filters: snel op de telefoon en scherp bij printen):
//   1. een zachte buitenrand: golvend, half doorzichtig, iets groter dan de regio;
//   2. de mist zelf: golvend, dekkend, net iets groter dan de regio;
//   3. "wolken": vage lichtere en donkere vlekken (kleurverloop), bijgeknipt op de mist.
// Waar een muur staat, blijft de rand recht (de mist loopt niet door de muur).

import { cellEdge } from '../coords';
import { isCellHidden } from '../fog';
import type { DoorItem, MapData } from '../schema';
import { FOG } from '../tiles/palette';
import { hash } from '../tiles/fa';
import { onWalls, raggedRect } from './edge';
import { S, svgEl } from './svg';
import { renderDoor } from './walls';

export function renderFog(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  const hidden = map.regions.filter((r) => r.hidden);
  if (!hidden.length) return;

  const defs = svgEl('defs', {}, g);
  for (const [id, color] of [['fog-cloud-light', FOG.cloudLight], ['fog-cloud-dark', FOG.cloudDark]]) {
    const grad = svgEl('radialGradient', { id }, defs);
    svgEl('stop', { offset: '0%', 'stop-color': color }, grad);
    svgEl('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }, grad);
  }

  const segments: [number, number, number, number][] = [];
  for (const w of map.walls) {
    for (let k = 1; k < w.points.length; k++) {
      const [x1, y1] = w.points[k - 1];
      const [x2, y2] = w.points[k];
      segments.push([x1 * S, y1 * S, x2 * S, y2 * S]);
    }
  }
  // Een dichte deur houdt de mist ook tegen; door een open deur lekt er wat uit.
  for (const dr of map.doors) {
    if (dr.state === 'open' || dr.tile === 'arch') continue;
    const e = cellEdge(dr.cell, dr.side);
    segments.push([e.x1 * S, e.y1 * S, e.x2 * S, e.y2 * S]);
  }
  const walled = onWalls(segments);

  for (const r of hidden) {
    const { c1, r1, c2, r2 } = r.rect;
    const x = c1 * S, y = r1 * S, w = (c2 - c1 + 1) * S, h = (r2 - r1 + 1) * S;
    const seed = `${map.name}|fog|${r.id}`;
    const group = svgEl('g', { class: 'fog', 'data-region': r.id }, g);
    svgEl('path', {
      d: raggedRect(x, y, w, h, S * 0.45, S * 1.1, S / 6, `${seed}|edge`, walled),
      fill: FOG.color, opacity: FOG.edgeOpacity, class: 'fog-edge',
    }, group);
    const d = raggedRect(x, y, w, h, S * 0.18, S * 0.9, S / 6, seed, walled);
    svgEl('path', { d, fill: FOG.color, class: 'fog-body' }, group);

    // Wolken: vaste plekken (dobbelsteen op de regio), bijgeknipt op de mist.
    const clip = svgEl('clipPath', { id: `fog-clip-${r.id.replace(/[^a-zA-Z0-9_-]/g, '_')}` }, defs);
    svgEl('path', { d }, clip);
    const clouds = svgEl('g', { 'clip-path': `url(#${clip.id})` }, group);
    const count = Math.max(3, Math.round(((c2 - c1 + 1) * (r2 - r1 + 1)) / 2));
    for (let i = 0; i < count; i++) {
      const rnd = (k: string) => hash(`${seed}|${i}|${k}`) / 0xffffffff;
      svgEl('circle', {
        cx: x + rnd('x') * w,
        cy: y + rnd('y') * h,
        r: S * (0.8 + rnd('r') * 1.2),
        fill: `url(#${i % 3 === 0 ? 'fog-cloud-dark' : 'fog-cloud-light'})`,
      }, clouds);
    }
  }

  // Een deur op de rand van de mist zie je van buitenaf wel: die tekenen we nog
  // eens bovenop, zodat je ziet of ze open, dicht of op slot is.
  for (const d of map.doors) if (onFogEdge(map, d)) renderDoor(g, d, map.name);
}

function onFogEdge(map: MapData, d: DoorItem): boolean {
  const e = cellEdge(d.cell, d.side);
  const other = { c: d.cell.c - e.nx, r: d.cell.r - e.ny };
  if (other.c < 0 || other.r < 0 || other.c >= map.cols || other.r >= map.rows) return false;
  return isCellHidden(map, d.cell) !== isCellHidden(map, other);
}
