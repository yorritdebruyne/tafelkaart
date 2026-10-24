import type { MapData } from '../schema';
import { floorImage } from '../tiles';
import { FLOOR, ORGANIC_FLOORS, UNKNOWN } from '../tiles/palette';
import { onWalls, raggedRect } from './edge';
import { S, svgEl } from './svg';

// Vloeren: eerst een effen kleur uit palette.ts. Is er een afbeelding (eigen bestand
// of een textuur uit Forgotten Adventures), dan leggen we die er bovenop als patroon
// dat herhaald wordt (een SVG-<pattern>, zoals een tegelvloer). Een eigen bestand
// is 1 vakje groot; een FA-textuur heeft haar echte grootte (bv. 3×3 vakjes).
// Per kaart en per vloer kiest de app één textuur, zodat alle "dirt" op de kaart gelijk is.
//
// Natuurlijke vloeren (ORGANIC_FLOORS in palette.ts) krijgen een golvende rand die tot
// SPILL over de vloer eronder loopt. Alles wordt bijgeknipt op de rand van de kaart.

/** Hoe ver een natuurlijke vloer maximaal over zijn rand loopt. */
const SPILL = S * 0.3;

export function renderFloor(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  // Achtergrond voor vakjes zonder vloer.
  svgEl('rect', { x: 0, y: 0, width: map.cols * S, height: map.rows * S, class: 'map-empty' }, g);

  const defs = svgEl('defs', {}, g);
  // Niets buiten de kaart tekenen (golvende randen aan de buitenkant).
  const mapClip = svgEl('clipPath', { id: 'floor-map-clip' }, defs);
  svgEl('rect', { x: 0, y: 0, width: map.cols * S, height: map.rows * S }, mapClip);
  const layer = svgEl('g', { 'clip-path': 'url(#floor-map-clip)' }, g);
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

  // Muurstukken in SVG-eenheden: daar blijft een golvende rand recht.
  const segments: [number, number, number, number][] = [];
  for (const w of map.walls) {
    for (let k = 1; k < w.points.length; k++) {
      const [x1, y1] = w.points[k - 1];
      const [x2, y2] = w.points[k];
      segments.push([x1 * S, y1 * S, x2 * S, y2 * S]);
    }
  }
  const walled = onWalls(segments);

  map.floor.forEach((f, i) => {
    const { c1, r1, c2, r2 } = f.rect;
    const color = FLOOR[f.tile];
    const pattern = patternFor(f.tile);
    const box = {
      x: c1 * S,
      y: r1 * S,
      width: (c2 - c1 + 1) * S,
      height: (r2 - r1 + 1) * S,
    };
    if (ORGANIC_FLOORS.has(f.tile) && (color || pattern)) {
      // Golvende rand: één vorm met de kleur en de textuur erin.
      const d = raggedRect(box.x, box.y, box.width, box.height, SPILL, S * 1.3, S / 6, `${map.name}|${i}|${f.tile}`, walled);
      if (color) svgEl('path', { d, fill: color }, layer);
      if (pattern) svgEl('path', { d, fill: `url(#${pattern})`, 'data-tile': f.tile }, layer);
      return;
    }
    svgEl('rect', { ...box, fill: color ?? (pattern ? 'none' : UNKNOWN) }, layer);
    if (pattern) svgEl('rect', { ...box, fill: `url(#${pattern})`, 'data-tile': f.tile }, layer);

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
          }, layer);
          t.textContent = f.tile;
        }
      }
    }
  });
}
