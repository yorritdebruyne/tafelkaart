import type { MapData } from '../schema';
import { floorImage } from '../tiles';
import { FLOOR, UNKNOWN } from '../tiles/palette';
import { S, svgEl } from './svg';

// Vloeren: eerst een effen kleur uit palette.ts. Is er een afbeelding (eigen bestand
// of een textuur uit Forgotten Adventures), dan leggen we die er bovenop als patroon
// dat herhaald wordt (een SVG-<pattern>, zoals een tegelvloer). Een eigen bestand
// is 1 vakje groot; een FA-textuur heeft haar echte grootte (bv. 3×3 vakjes).
// Per kaart en per vloer kiest de app één textuur, zodat alle "dirt" op de kaart gelijk is.

export function renderFloor(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  // Achtergrond voor vakjes zonder vloer.
  svgEl('rect', { x: 0, y: 0, width: map.cols * S, height: map.rows * S, class: 'map-empty' }, g);

  const defs = svgEl('defs', {}, g);
  const patterns = new Map<string, string>();
  const patternFor = (tile: string): string | undefined => {
    let id = patterns.get(tile);
    if (id) return id;
    const img = floorImage(tile, `${map.name}|${tile}`);
    if (!img) return undefined;
    id = `tile-floor-${tile.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const w = img.w * S;
    const h = img.h * S;
    const pattern = svgEl('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse' }, defs);
    svgEl('image', { href: img.url, width: w, height: h, preserveAspectRatio: 'none' }, pattern);
    patterns.set(tile, id);
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
