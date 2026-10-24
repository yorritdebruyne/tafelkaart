import { cellEdge } from '../coords';
import type { DoorItem, MapData, WallItem } from '../schema';
import { type WallImage, wallImage } from '../tiles';
import { DOOR, UNKNOWN, WALL } from '../tiles/palette';
import { S, svgEl } from './svg';

const WALL_WIDTH = S * 0.16;

// Muren: met Forgotten Adventures een strook textuur langs elk stuk muur, en een
// hoekstuk op elk knikpunt en uiteinde (zoals in Dungeondraft). Zonder FA: een effen lijn.
// Per kaart en per muurtype kiest de app één strook, zodat alle houten muren gelijk zijn.

export function renderWalls(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  const defs = svgEl('defs', {}, g);
  const chosen = new Map<string, { img: WallImage; pattern: string } | null>();
  const textureFor = (tile: string) => {
    if (!chosen.has(tile)) {
      const img = wallImage(tile, `${map.name}|${tile}`);
      let entry: { img: WallImage; pattern: string } | null = null;
      if (img) {
        const pattern = `tile-wall-${tile.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const w = img.strip.w * S;
        const h = img.strip.h * S;
        // De strook ligt met het midden van de muurband op y = 0 (de muurlijn).
        const y = -((img.strip.band[0] + img.strip.band[1]) / 2) * h;
        const pat = svgEl('pattern', { id: pattern, x: 0, y, width: w, height: h, patternUnits: 'userSpaceOnUse' }, defs);
        svgEl('image', { href: img.strip.url, width: w, height: h, preserveAspectRatio: 'none' }, pat);
        entry = { img, pattern };
      }
      chosen.set(tile, entry);
    }
    return chosen.get(tile)!;
  };

  for (const w of map.walls) {
    const tex = textureFor(w.tile);
    if (tex) renderTexturedWall(g, w, tex.img, tex.pattern);
    else {
      svgEl('polyline', {
        points: w.points.map(([x, y]) => `${x * S},${y * S}`).join(' '),
        stroke: WALL[w.tile] ?? UNKNOWN,
        'stroke-width': WALL_WIDTH,
        class: 'wall',
      }, g);
    }
  }
  for (const d of map.doors) renderDoor(g, d);
}

function renderTexturedWall(g: SVGGElement, w: WallItem, img: WallImage, pattern: string): void {
  const group = svgEl('g', { class: 'wall-textured' }, g);
  const h = img.strip.h * S;
  const band = (img.strip.band[1] - img.strip.band[0]) * h;
  const y = -((img.strip.band[0] + img.strip.band[1]) / 2) * h;
  for (let i = 1; i < w.points.length; i++) {
    const [x1, y1] = w.points[i - 1];
    const [x2, y2] = w.points[i];
    const len = Math.hypot(x2 - x1, y2 - y1) * S;
    if (!len) continue;
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    // Een halve muurdikte verder aan beide kanten, zodat hoeken dicht zijn.
    const seg = svgEl('g', { transform: `translate(${x1 * S} ${y1 * S}) rotate(${angle})` }, group);
    svgEl('rect', { x: -band / 2, y, width: len + band, height: h, fill: `url(#${pattern})` }, seg);
  }
  if (!img.connector) return;
  const cw = img.connector.w * S;
  const ch = img.connector.h * S;
  for (const [x, yy] of w.points) {
    svgEl('image', {
      href: img.connector.url, x: x * S - cw / 2, y: yy * S - ch / 2, width: cw, height: ch, class: 'wall-connector',
    }, group);
  }
}

export function renderDoor(g: SVGGElement, d: DoorItem): void {
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
