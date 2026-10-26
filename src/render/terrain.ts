// Moeilijk terrein (F12): schuine streepjes over de vakjes die de DM als "difficult" opgaf.
//
// Een patroon (<pattern>) is een klein tegeltje dat SVG zelf herhaalt: één definitie,
// en alle vakjes samen zijn één <path>. Dat is goedkoop, ook op de Pi.
// Elk streepje is een lichte lijn met een donkere schaduw ernaast, zodat je het ziet
// op lichte en op donkere vloeren. Puin, struiken en water zijn ook moeilijk, maar dat
// zie je al aan de tekening: die arceren we niet.
// Vakjes in de mist slaan we over (niets verklappen).

import { isCellHidden } from '../fog';
import type { MapData } from '../schema';
import { TERRAIN } from '../tiles/palette';
import { S, svgEl } from './svg';

export function renderTerrain(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  const seen = new Set<string>();
  let d = '';
  for (const t of map.terrain) {
    for (let r = t.rect.r1; r <= t.rect.r2; r++) {
      for (let c = t.rect.c1; c <= t.rect.c2; c++) {
        const key = `${c},${r}`;
        if (seen.has(key) || isCellHidden(map, { c, r })) continue;
        seen.add(key);
        d += `M${c * S} ${r * S}h${S}v${S}h${-S}z`;
      }
    }
  }
  if (!d) return;

  const k = TERRAIN.spacing;
  const defs = svgEl('defs', {}, g);
  const pat = svgEl('pattern', {
    id: 'terrain-difficult', width: k, height: k, patternUnits: 'userSpaceOnUse',
    patternTransform: 'rotate(45)',
  }, defs);
  svgEl('line', { x1: 2, y1: 0, x2: 2, y2: k, stroke: TERRAIN.dark, 'stroke-width': TERRAIN.width }, pat);
  svgEl('line', { x1: 0, y1: 0, x2: 0, y2: k, stroke: TERRAIN.light, 'stroke-width': TERRAIN.width }, pat);
  const path = svgEl('path', { d, fill: 'url(#terrain-difficult)', class: 'terrain-difficult' }, g);
  const title = svgEl('title', {}, path);
  title.textContent = 'Moeilijk terrein: elk vakje kost 1 extra';
}
