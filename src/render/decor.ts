// Automatische versiering: kleine dingen (takjes, blaadjes, onkruid, steentjes) die de app
// zelf strooit op natuurlijke vloeren, zodat een kaart er "bewoond" uitziet zonder dat de DM
// elk blaadje moet opschrijven. Puur decor: het telt niet mee voor beweging.
//
// Per vakje beslist een vaste "dobbelsteen" (op kaartnaam + vakje) of er iets ligt, wat,
// hoe gedraaid en hoe groot. Dezelfde kaart ziet er dus altijd hetzelfde uit.
// Hoeveel er ligt, hangt af van de sfeer ("decor" in fa-map.json). Niet op vakjes met een prop.

import type { MapData } from '../schema';
import { decorFor } from '../tiles';
import { hash } from '../tiles/fa';
import { S, svgEl } from './svg';

export function renderDecor(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  if (!map.floor.length) return;

  // Welke vloer ligt bovenaan op elk vakje? (later in de lijst = bovenop)
  const top: (string | undefined)[] = new Array(map.cols * map.rows);
  for (const f of map.floor) {
    for (let r = f.rect.r1; r <= f.rect.r2; r++) {
      for (let c = f.rect.c1; c <= f.rect.c2; c++) top[r * map.cols + c] = f.tile;
    }
  }
  // Vakjes met een prop: daar strooien we niets.
  const taken = new Set<number>();
  for (const p of map.props) {
    for (let r = p.rect.r1; r <= p.rect.r2; r++) {
      for (let c = p.rect.c1; c <= p.rect.c2; c++) taken.add(r * map.cols + c);
    }
  }

  const cache = new Map<string, ReturnType<typeof decorFor>>();
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const i = r * map.cols + c;
      const tile = top[i];
      if (!tile || taken.has(i)) continue;
      if (!cache.has(tile)) cache.set(tile, decorFor(tile));
      const decor = cache.get(tile);
      if (!decor) continue;
      const rnd = (k: string) => hash(`${map.name}|decor|${c},${r}|${k}`) / 0xffffffff;
      if (rnd('ja') >= decor.density) continue;
      const url = decor.urls[Math.floor(rnd('wat') * decor.urls.length)];
      const size = S * (0.55 + 0.4 * rnd('grootte'));
      const cx = c * S + S / 2 + (rnd('x') - 0.5) * S * 0.5;
      const cy = r * S + S / 2 + (rnd('y') - 0.5) * S * 0.5;
      svgEl('image', {
        href: url, x: -size / 2, y: -size / 2, width: size, height: size,
        transform: `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${Math.floor(rnd('draai') * 360)})`,
        class: 'decor',
      }, g);
    }
  }
}
