// Een variant kiezen uit de Forgotten Adventures-index.
//
// De index (src/tiles/prive/fa-index.json, gemaakt door `npm run fa-index`) geeft per
// tegel-id een lijst afbeeldingen. Hier kiezen we er één, in drie stappen:
//   1. Grootte: een afbeelding die in de vakjes van de prop past, zo groot mogelijk.
//      Een 2×1-afbeelding mag ook een kwartslag draaien om in 1×2 vakjes te passen.
//      Past niets, dan nemen we de kleinste en schalen we die in.
//   2. Thema: woorden in de bestandsnaam (bv. "Broken" voor een verlaten dorp).
//   3. Dobbelsteen: uit wat overblijft kiezen we met een vaste "dobbelsteen" op
//      de plek op de kaart, zodat elk vakje er bij elke herlading hetzelfde uitziet.

export interface Theme { prefer: string[]; avoid: string[]; }
/** [pad, breedte in vakjes, hoogte in vakjes, en voor muur-props: kader x1, y1, x2, y2 (0..1)] */
export type PropEntry = [string, number, number, ...number[]];

export interface FaIndex {
  pxPerCell: number;
  themes: Record<string, Theme>;
  /** Props die tegen een muur horen; `prefer` = liefst bestanden met dit woord. */
  wall?: Record<string, { prefer?: string }>;
  props: Record<string, PropEntry[]>;
  /** [pad, breedte in px, hoogte in px] */
  floor: Record<string, [string, number, number][]>;
  /** Muren: stroken en hoekstukken, elk [pad, breedte px, hoogte px, kader x1, y1, x2, y2 (0..1)]. */
  walls?: Record<string, { strips: WallEntry[]; connectors: WallEntry[] }>;
}

export type WallEntry = [string, number, number, number, number, number, number];

export interface WallPick {
  strip: WallEntry;
  /** Het hoekstuk van dezelfde soort (zelfde naam vóór "_Straight_Path"), als dat er is. */
  connector?: WallEntry;
}

export interface PropPick {
  path: string;
  /** Afmetingen in vakjes zoals getekend (na eventueel draaien, vóór inschalen). */
  w: number;
  h: number;
  /** true = afbeelding een kwartslag draaien om te passen. */
  turn: boolean;
  /** < 1 als de afbeelding groter is dan de vakjes en ingeschaald wordt. */
  scale: number;
  /** Waar de tekening in de afbeelding staat (0..1), als bekend. */
  box?: [number, number, number, number];
}

export interface PickOptions {
  theme?: Theme;
  /** Alleen bestanden met dit woord, als die er zijn (bv. "Wall" voor ladders tegen de muur). */
  prefer?: string;
  /** Niet een kwartslag draaien (muur-props: de achterkant moet tegen de muur). */
  noTurn?: boolean;
}

/** Kleine, vaste hash (FNV-1a) van een tekst -> getal. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Hoe goed past een bestandsnaam bij het thema? Woorden tellen, "avoid" zwaar negatief. */
export function themeScore(path: string, theme: Theme | undefined): number {
  if (!theme) return 0;
  const words = new Set(path.slice(path.lastIndexOf('/') + 1).split(/[_.]/).map((w) => w.toLowerCase()));
  let s = 0;
  for (const w of theme.prefer) if (words.has(w.toLowerCase())) s += 1;
  for (const w of theme.avoid) if (words.has(w.toLowerCase())) s -= 10;
  return s;
}

/** Hoogste waarde van `score` behouden. */
function best<T>(items: T[], score: (t: T) => number): T[] {
  let max = -Infinity;
  let out: T[] = [];
  for (const t of items) {
    const s = score(t);
    if (s > max) { max = s; out = [t]; } else if (s === max) out.push(t);
  }
  return out;
}

export function pickProp(
  cands: PropEntry[] | undefined,
  lw: number,
  lh: number,
  seed: string,
  opts: PickOptions = {},
): PropPick | undefined {
  if (!cands?.length) return undefined;
  const { theme, prefer, noTurn } = opts;
  if (prefer) {
    const word = new RegExp(`(^|[_/])${prefer}(_|\\.)`, 'i');
    const withWord = cands.filter(([path]) => word.test(path));
    if (withWord.length) cands = withWord;
  }
  // Elke kandidaat in beide richtingen.
  const options = cands.flatMap(([path, w, h, ...rest]) => {
    const box = rest.length === 4 ? (rest as [number, number, number, number]) : undefined;
    const o = [{ path, w, h, turn: false, box }];
    if (w !== h && !noTurn) o.push({ path, w: h, h: w, turn: true, box });
    return o;
  });
  const fits = options.filter((o) => o.w <= lw && o.h <= lh);
  let pool: typeof options;
  if (fits.length) {
    // Zo groot mogelijk; liever niet gedraaid.
    pool = best(best(fits, (o) => o.w * o.h), (o) => (o.turn ? 0 : 1));
  } else {
    // Niets past: zo weinig mogelijk inschalen.
    pool = best(best(options, (o) => -Math.max(o.w / lw, o.h / lh)), (o) => (o.turn ? 0 : 1));
  }
  pool = best(pool, (o) => themeScore(o.path, theme));
  const pick = pool[hash(seed) % pool.length];
  return { ...pick, scale: Math.min(1, lw / pick.w, lh / pick.h) };
}

/** Strook + passend hoekstuk voor een muurtype (één keuze per kaart en per type). */
export function pickWall(
  set: { strips: WallEntry[]; connectors: WallEntry[] } | undefined,
  seed: string,
  theme?: Theme,
): WallPick | undefined {
  if (!set?.strips.length) return undefined;
  const pool = best(set.strips, ([path]) => themeScore(path, theme));
  const strip = pool[hash(seed) % pool.length];
  const name = strip[0].slice(strip[0].lastIndexOf('/') + 1);
  const base = name.replace(/_Straight_Path\.png$|_Path\.png$/i, '');
  const connector = set.connectors.find(([p]) => p.slice(p.lastIndexOf('/') + 1).startsWith(`${base}_Connector`));
  return { strip, connector };
}

export function pickFloor(
  cands: [string, number, number][] | undefined,
  seed: string,
  theme?: Theme,
): { path: string; px: number; py: number } | undefined {
  if (!cands?.length) return undefined;
  const pool = best(cands, ([path]) => themeScore(path, theme));
  const [path, px, py] = pool[hash(seed) % pool.length];
  return { path, px, py };
}
