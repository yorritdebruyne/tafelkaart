import type { MapData } from '../schema';
import { tileImage } from '../tiles';
import { FLOOR, UNKNOWN } from '../tiles/palette';
import { S, svgEl } from './svg';

// Vloeren: eerst een effen kleur uit palette.ts. Staat er een afbeelding in
// src/tiles/floor/<id>.svg (of .png), dan leggen we die er bovenop als patroon
// dat elk vakje herhaald wordt (een SVG-<pattern>, zoals een tegelvloer).

export function renderFloor(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  // Achtergrond voor vakjes zonder vloer.
  svgEl('rect', { x: 0, y: 0, width: map.cols * S, height: map.rows * S, class: 'map-empty' }, g);

  const defs = svgEl('defs', {}, g);
  const patterns = new Map<string, string>();
  const patternFor = (tile: string): string | undefined => {
    const url = tileImage('floor', tile);
    if (!url) return undefined;
    let id = patterns.get(tile);
    if (!id) {
      id = `tile-floor-${tile.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const pattern = svgEl('pattern', { id, width: S, height: S, patternUnits: 'userSpaceOnUse' }, defs);
      svgEl('image', { href: url, width: S, height: S, preserveAspectRatio: 'none' }, pattern);
      patterns.set(tile, id);
    }
    return id;
  };

  for (const f of map.floor) {
    const { c1, r1, c2, r2 } = f.rect;
    const color = FLOOR[f.tile];
    const pattern = patternFor(f.tile);
    const box = {
      x: c1 * S,
      y: r1 * S,
      width: (c2 - c1 + 1) * S,
      height: (r2 - r1 + 1) * S,
    };
    svgEl('rect', { ...box, fill: color ?? (pattern ? 'none' : UNKNOWN) }, g);
    if (pattern) svgEl('rect', { ...box, fill: `url(#${pattern})`, 'data-tile': f.tile }, g);

    // F18: onbekende tegel -> grijs vakje met de naam erin.
    if (!color && !pattern) {
      const fontSize = Math.min(14, (S * 0.8) / Math.max(1, f.tile.length * 0.62));
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const t = svgEl('text', {
            x: c * S + S / 2,
            y: r * S + S / 2,
            'font-size': fontSize,
            class: 'unknown-label',
          }, g);
          t.textContent = f.tile;
        }
      }
    }
  }
}
