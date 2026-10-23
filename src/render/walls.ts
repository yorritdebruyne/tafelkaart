import { cellEdge } from '../coords';
import type { DoorItem, MapData } from '../schema';
import { DOOR, UNKNOWN, WALL } from '../tiles/palette';
import { S, svgEl } from './svg';

const WALL_WIDTH = S * 0.16;

export function renderWalls(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  for (const w of map.walls) {
    svgEl('polyline', {
      points: w.points.map(([x, y]) => `${x * S},${y * S}`).join(' '),
      stroke: WALL[w.tile] ?? UNKNOWN,
      'stroke-width': WALL_WIDTH,
      class: 'wall',
    }, g);
  }
  for (const d of map.doors) renderDoor(g, d);
}

function renderDoor(g: SVGGElement, d: DoorItem): void {
  const e = cellEdge(d.cell, d.side);
  const color = DOOR[d.tile] ?? UNKNOWN;
  const x1 = e.x1 * S, y1 = e.y1 * S, x2 = e.x2 * S, y2 = e.y2 * S;
  const horizontal = e.y1 === e.y2;
  const len = S * 0.86;
  const thick = S * 0.2;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const group = svgEl('g', { class: `door door-${d.state}`, 'data-door': d.id }, g);

  // Rechthoek langs de rand (dichte deur, raam, ...).
  const along = (t: number, cls: string, fill: string) =>
    svgEl('rect', {
      x: horizontal ? cx - len / 2 : cx - t / 2,
      y: horizontal ? cy - t / 2 : cy - len / 2,
      width: horizontal ? len : t,
      height: horizontal ? t : len,
      fill,
      class: cls,
    }, group);

  if (d.tile === 'arch') {
    // Boog: twee pilaartjes aan de uiteinden, altijd doorgang.
    for (const [px, py] of [[x1, y1], [x2, y2]]) {
      svgEl('rect', { x: px - thick / 2, y: py - thick / 2, width: thick, height: thick, fill: color, class: 'door-leaf' }, group);
    }
    return;
  }

  if (d.state === 'open') {
    // Open: een stippellijn op de rand + het deurblad dat naar binnen openzwaait.
    svgEl('line', { x1, y1, x2, y2, class: 'door-gap' }, group);
    const leaf = S * 0.8, t = S * 0.12;
    const hx = x1, hy = y1; // scharnier op het eerste hoekpunt
    svgEl('rect', {
      x: e.nx !== 0 ? (e.nx > 0 ? hx : hx - leaf) : hx - t / 2,
      y: e.ny !== 0 ? (e.ny > 0 ? hy : hy - leaf) : hy - t / 2,
      width: e.nx !== 0 ? leaf : t,
      height: e.ny !== 0 ? leaf : t,
      fill: color,
      class: 'door-leaf',
    }, group);
    return;
  }

  if (d.tile === 'window') {
    along(thick * 0.6, 'door-leaf window', color);
    return;
  }

  along(thick, 'door-leaf', color);
  if (d.state === 'locked') {
    // Op slot: rode rand en een sleutelgat.
    along(thick, 'door-locked', 'none');
    svgEl('circle', { cx, cy, r: thick * 0.28, class: 'door-keyhole' }, group);
  }
}
