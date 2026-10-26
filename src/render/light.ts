// Licht (F13) tekenen: een donkere laag over de kaart, met "gaten" waar licht valt,
// en een zachte gekleurde gloed rond elke bron.
//
// Hoe, zonder zware filters (denk aan de Raspberry Pi):
//   - Donker: één rechthoek over de kaart met een <mask>. In een masker betekent wit
//     "tonen" en zwart "weglaten". We beginnen wit (overal donker) en tekenen per bron
//     een zwarte cirkel met een kleurverloop naar doorzichtig: in het midden verdwijnt
//     het donker helemaal, naar de rand komt het geleidelijk terug (schemer).
//   - Gloed: dezelfde cirkel in de kleur van het licht, half doorzichtig.
//   - Beide worden bijgeknipt (clip-path) op de veelhoek uit light.ts, zodat licht
//     niet door muren of dichte deuren schijnt.
// Deze laag ligt onder de tokens: je eigen tokens blijven altijd goed zichtbaar.

import { isDark, type LightMode, lightBlockers, lightSources, visibilityPolygon } from '../light';
import type { MapData } from '../schema';
import { LIGHT } from '../tiles/palette';
import { S, svgEl } from './svg';

let mode: LightMode = 'auto';

export function setLightMode(m: LightMode): void {
  mode = m;
}

export function getLightMode(): LightMode {
  return mode;
}

export function renderLight(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  if (!isDark(map, mode)) return;
  const W = map.cols * S, H = map.rows * S;
  const defs = svgEl('defs', {}, g);

  // Kleurverloop voor de gaten in het donker: helder tot de helft, dan uitdoven.
  const hole = svgEl('radialGradient', { id: 'light-hole' }, defs);
  svgEl('stop', { offset: '0%', 'stop-color': '#000', 'stop-opacity': 1 }, hole);
  svgEl('stop', { offset: '45%', 'stop-color': '#000', 'stop-opacity': 0.95 }, hole);
  svgEl('stop', { offset: '75%', 'stop-color': '#000', 'stop-opacity': 0.45 }, hole);
  svgEl('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0 }, hole);

  const mask = svgEl('mask', { id: 'light-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
  svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }, mask);

  const glows = svgEl('g', { class: 'light-glow' });
  const segs = lightBlockers(map);
  const glowIds = new Map<string, string>();
  lightSources(map).forEach((src, i) => {
    const reach = src.radius * 2;
    const poly = visibilityPolygon(src.x, src.y, reach, segs);
    const clip = svgEl('clipPath', { id: `light-clip-${i}` }, defs);
    svgEl('polygon', { points: poly.map(([x, y]) => `${(x * S).toFixed(1)},${(y * S).toFixed(1)}`).join(' ') }, clip);
    const circle = { cx: src.x * S, cy: src.y * S, r: reach * S };

    svgEl('circle', { ...circle, fill: 'url(#light-hole)', 'clip-path': `url(#${clip.id})` }, mask);

    // Eén kleurverloop per kleur (niet per bron).
    let gid = glowIds.get(src.color);
    if (!gid) {
      gid = `light-glow-${glowIds.size}`;
      glowIds.set(src.color, gid);
      const grad = svgEl('radialGradient', { id: gid }, defs);
      svgEl('stop', { offset: '0%', 'stop-color': src.color, 'stop-opacity': LIGHT.glow }, grad);
      svgEl('stop', { offset: '50%', 'stop-color': src.color, 'stop-opacity': LIGHT.glow * 0.55 }, grad);
      svgEl('stop', { offset: '100%', 'stop-color': src.color, 'stop-opacity': 0 }, grad);
    }
    svgEl('circle', { ...circle, fill: `url(#${gid})`, 'clip-path': `url(#${clip.id})` }, glows);
  });

  svgEl('rect', {
    x: 0, y: 0, width: W, height: H, fill: LIGHT.color, opacity: LIGHT.darkness,
    mask: 'url(#light-mask)', class: 'light-dark',
  }, g);
  g.appendChild(glows);
}
