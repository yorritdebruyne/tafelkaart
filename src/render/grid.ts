import { colToLetters } from '../coords';
import type { MapData } from '../schema';
import { S, svgEl } from './svg';

/** Gridlijnen als één <path>: veel sneller dan honderden losse lijnen. */
export function renderGrid(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  const w = map.cols * S;
  const h = map.rows * S;
  let d = '';
  for (let c = 0; c <= map.cols; c++) d += `M${c * S} 0V${h}`;
  for (let r = 0; r <= map.rows; r++) d += `M0 ${r * S}H${w}`;
  svgEl('path', { d, class: 'grid-lines' }, g);
}

/** Letters bovenaan, cijfers links (in de marge met negatieve coördinaten). */
export function renderLabels(g: SVGGElement, map: MapData, gutter: number): void {
  g.replaceChildren();
  for (let c = 0; c < map.cols; c++) {
    const t = svgEl('text', { x: c * S + S / 2, y: -gutter / 2, class: 'coord-label' }, g);
    t.textContent = colToLetters(c);
  }
  for (let r = 0; r < map.rows; r++) {
    const t = svgEl('text', { x: -gutter / 2, y: r * S + S / 2, class: 'coord-label' }, g);
    t.textContent = String(r + 1);
  }
}
