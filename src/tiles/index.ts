// De tegel-lader: zoekt een afbeelding voor vloeren en props.
//
// Waar zoekt de app, in deze volgorde:
//   1. src/tiles/prive/floor/<id>.png en src/tiles/prive/props/<id>.png
//      -> één vaste afbeelding die je zelf kiest en die NIET op GitHub mag. (.gitignore)
//   2. src/tiles/floor/<id> en src/tiles/props/<id>
//      -> eigen tegels of tegels met een vrije licentie (CC0). Die gaan wel mee naar GitHub.
//   3. Forgotten Adventures, via src/tiles/prive/fa-index.json (`npm run fa-index`).
//      De app kiest zelf een variant die past, volgens de gekozen sfeer.
//   4. Niets gevonden? Dan een reserve-tekening met de kleur uit palette.ts.
// Staat dezelfde id er twee keer in één map (barrel.png én barrel.svg), dan wint PNG/WebP.
//
// import.meta.glob is een functie van Vite: bij het bouwen zoekt Vite alle
// bestanden die op het patroon passen. Met '?url' krijgen we per bestand een
// adres; de browser laadt de afbeelding pas als ze op de kaart komt.

import { type FaIndex, pickFloor, pickProp } from './fa';

const FILES = import.meta.glob(
  ['./{floor,props}/*.{svg,png,webp,jpg,jpeg}', './prive/{floor,props}/*.{svg,png,webp,jpg,jpeg}'],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

const FA_FILES = import.meta.glob('./prive/fa-index.json', { eager: true, import: 'default' }) as Record<string, FaIndex>;

export type TileKind = 'floor' | 'props';
type Index = Record<TileKind, Record<string, string>>;

const EXT_ORDER = ['png', 'webp', 'jpg', 'jpeg', 'svg'];

/** Bouwt de opzoektabel id -> adres. Apart zodat de volgorde te testen is. */
export function buildIndex(files: Record<string, string>): Index {
  const index: Index = { floor: {}, props: {} };
  const rank: Record<string, number> = {};
  for (const [path, url] of Object.entries(files)) {
    const m = /^\.\/(prive\/)?(floor|props)\/(.+)\.([a-z]+)$/i.exec(path);
    if (!m) continue;
    const kind = m[2] as TileKind;
    const id = m[3];
    // Lager = beter: privémap eerst, daarna volgens extensie.
    const r = (m[1] ? 0 : 10) + Math.max(0, EXT_ORDER.indexOf(m[4].toLowerCase()));
    const key = `${kind}/${id}`;
    if (rank[key] === undefined || r < rank[key]) {
      rank[key] = r;
      index[kind][id] = url;
    }
  }
  return index;
}

const INDEX = buildIndex(FILES);
let fa: FaIndex | undefined = Object.values(FA_FILES)[0];
let sfeer = 'standaard';

/** Voor tests: een andere FA-index gebruiken (of geen). */
export function setFaIndex(index: FaIndex | undefined): void {
  fa = index;
}

/** De sferen uit fa-map.json (leeg zonder FA-index). */
export function sfeerNames(): string[] {
  return fa ? Object.keys(fa.themes) : [];
}
export function getSfeer(): string {
  return sfeer;
}
export function setSfeer(name: string): void {
  sfeer = name;
}

/** Adres van een FA-bestand (de dev-server toont het uit de map in .env.local). */
export function faUrl(path: string): string {
  return 'fa/' + path.split('/').map(encodeURIComponent).join('/');
}

/** De vaste afbeelding voor een tegel (stap 1 en 2), of undefined. */
export function tileImage(kind: TileKind, id: string): string | undefined {
  return INDEX[kind][id];
}

/** Heeft de app iets om deze tegel te tekenen (behalve de reserve-tekening)? */
export function hasTile(kind: TileKind, id: string): boolean {
  return !!INDEX[kind][id] || !!fa?.[kind][id]?.length;
}

export interface PropImage {
  url: string;
  /** Afmetingen in vakjes zoals getekend. */
  w: number;
  h: number;
  /** Kwartslag draaien om te passen. */
  turn: boolean;
}

/**
 * Afbeelding voor een prop die `lw` × `lh` vakjes beslaat (vóór de rotatie `rot`).
 * `seed` maakt de keuze vast per plek op de kaart.
 */
export function propImage(id: string, lw: number, lh: number, seed: string): PropImage | undefined {
  const own = INDEX.props[id];
  if (own) return { url: own, w: lw, h: lh, turn: false };
  const pick = pickProp(fa?.props[id], lw, lh, seed, fa?.themes[sfeer]);
  if (!pick) return undefined;
  return { url: faUrl(pick.path), w: pick.w * pick.scale, h: pick.h * pick.scale, turn: pick.turn };
}

/** Afbeelding voor een vloer: adres + grootte van één herhaling, in vakjes. */
export function floorImage(id: string, seed: string): { url: string; w: number; h: number } | undefined {
  const own = INDEX.floor[id];
  if (own) return { url: own, w: 1, h: 1 };
  const pick = pickFloor(fa?.floor[id], seed, fa?.themes[sfeer]);
  if (!pick || !fa) return undefined;
  return { url: faUrl(pick.path), w: pick.px / fa.pxPerCell, h: pick.py / fa.pxPerCell };
}

/** Alle tegel-id's met een vaste afbeelding. */
export function tilesWithImage(kind: TileKind): string[] {
  return Object.keys(INDEX[kind]).sort();
}
