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
export interface FaIndex {
  pxPerCell: number;
  themes: Record<string, Theme>;
  /** [pad, breedte in vakjes, hoogte in vakjes] */
  props: Record<string, [string, number, number][]>;
  /** [pad, breedte in px, hoogte in px] */
  floor: Record<string, [string, number, number][]>;
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
  cands: [string, number, number][] | undefined,
  lw: number,
  lh: number,
  seed: string,
  theme?: Theme,
): PropPick | undefined {
  if (!cands?.length) return undefined;
  // Elke kandidaat in beide richtingen.
  const options = cands.flatMap(([path, w, h]) => {
    const o = [{ path, w, h, turn: false }];
    if (w !== h) o.push({ path, w: h, h: w, turn: true });
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
