// Een golvende rand rond een rechthoek, voor natuurlijke vloeren.
//
// We lopen langs de rand van de rechthoek en duwen elk punt een beetje naar buiten,
// volgens "ruis": een golvend getal dat traag op en neer gaat (zoals een heuvellijn).
// De rand ligt altijd tussen de echte rand en `spill` daarbuiten: de vloer wordt dus
// nooit kleiner dan de DM zei, alleen een beetje groter, over de vloer eronder.
// Zelfde zaad = zelfde rand, bij elke herlading.

import { hash } from '../tiles/fa';

/** Gladde ruis tussen 0 en 1 langs één as. */
export function noise1(seed: string, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash(`${seed}:${i}`) / 0xffffffff;
  const b = hash(`${seed}:${i + 1}`) / 0xffffffff;
  const s = (1 - Math.cos(f * Math.PI)) / 2; // zachte overgang
  return a + (b - a) * s;
}

/**
 * SVG-pad (d) van een golvende rechthoek in SVG-eenheden.
 * x, y, w, h = de echte rechthoek; spill = hoe ver de rand maximaal naar buiten gaat;
 * wave = lengte van één golf; step = afstand tussen de punten.
 * walled(px, py) = staat er op dit punt van de rand een muur? Dan blijft de rand daar recht
 * (een binnenvloer loopt niet onder de muur door naar buiten).
 */
export function raggedRect(
  x: number, y: number, w: number, h: number,
  spill: number, wave: number, step: number, seed: string,
  walled: (px: number, py: number) => boolean = () => false,
): string {
  const pts: string[] = [];
  let t = 0; // afstand langs de rand, voor de ruis
  const push = (px: number, py: number, nx: number, ny: number) => {
    // Twee lagen ruis: grote golven + kleine rafels.
    const n = 0.7 * noise1(seed, t / wave) + 0.3 * noise1(`${seed}~`, (t * 3) / wave);
    const d = walled(px, py) ? 0 : spill * (0.15 + 0.85 * n);
    pts.push(`${(px + nx * d).toFixed(1)},${(py + ny * d).toFixed(1)}`);
  };
  const side = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      push(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, nx, ny);
      t += len / n;
    }
  };
  const k = Math.SQRT1_2; // hoeken: schuin naar buiten
  push(x, y, -k, -k);
  side(x, y, x + w, y, 0, -1);
  push(x + w, y, k, -k);
  side(x + w, y, x + w, y + h, 1, 0);
  push(x + w, y + h, k, k);
  side(x + w, y + h, x, y + h, 0, 1);
  push(x, y + h, -k, k);
  side(x, y + h, x, y, -1, 0);
  return `M${pts.join('L')}Z`;
}

/**
 * Maakt een walled(px, py)-functie uit muren (punten in SVG-eenheden):
 * true als het punt op een muurstuk ligt (met een kleine marge).
 */
export function onWalls(segments: [number, number, number, number][], margin = 0.5): (px: number, py: number) => boolean {
  return (px, py) => segments.some(([x1, y1, x2, y2]) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (!len2) return false;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) <= margin;
  });
}
