// De tegel-lader: zoekt afbeeldingen voor vloeren en props.
//
// Een bestand heet zoals de tegel-id: props/barrel.png is de tegel "barrel".
// Waar zoekt de app, in deze volgorde:
//   1. src/tiles/prive/floor/ en src/tiles/prive/props/
//      -> tegels die NIET op GitHub mogen (bv. Forgotten Adventures, alleen
//         voor persoonlijk gebruik). Deze map staat in .gitignore.
//   2. src/tiles/floor/ en src/tiles/props/
//      -> eigen tegels of tegels met een vrije licentie (CC0). Die gaan wel mee naar GitHub.
//   3. Niets gevonden? Dan een reserve-tekening met de kleur uit palette.ts.
// Staat dezelfde id er twee keer in één map (barrel.png én barrel.svg), dan wint PNG/WebP.
//
// import.meta.glob is een functie van Vite: bij het bouwen zoekt Vite alle
// bestanden die op het patroon passen. Met '?url' krijgen we per bestand een
// adres; de browser laadt de afbeelding pas als ze op de kaart komt. Zo blijft
// de app vlot, ook met veel grote PNG's.

const FILES = import.meta.glob(
  ['./{floor,props}/*.{svg,png,webp,jpg,jpeg}', './prive/{floor,props}/*.{svg,png,webp,jpg,jpeg}'],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

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

/** De afbeelding voor een tegel, of undefined als er (nog) geen is. */
export function tileImage(kind: TileKind, id: string): string | undefined {
  return INDEX[kind][id];
}

/** Alle tegel-id's met een afbeelding (handig om te tonen wat er al is). */
export function tilesWithImage(kind: TileKind): string[] {
  return Object.keys(INDEX[kind]).sort();
}
