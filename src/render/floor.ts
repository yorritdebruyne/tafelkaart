import type { MapData } from '../schema';
import { FLOOR, UNKNOWN } from '../tiles/palette';
import { S, svgEl } from './svg';

export function renderFloor(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  // Achtergrond voor vakjes zonder vloer.
  svgEl('rect', { x: 0, y: 0, width: map.cols * S, height: map.rows * S, class: 'map-empty' }, g);

  for (const f of map.floor) {
    const { c1, r1, c2, r2 } = f.rect;
    const color = FLOOR[f.tile];
    svgEl('rect', {
      x: c1 * S,
      y: r1 * S,
      width: (c2 - c1 + 1) * S,
      height: (r2 - r1 + 1) * S,
      fill: color ?? UNKNOWN,
    }, g);

    // F18: onbekende tegel -> grijs vakje met de naam erin.
    if (!color) {
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
