// De tegel-lader: zoekt afbeeldingen in src/tiles/floor/ en src/tiles/props/.
//
// Een bestand heet zoals de tegel-id: src/tiles/props/barrel.svg is de tegel "barrel".
// Staat er geen bestand, dan tekent de app een reserve-tekening (placeholder)
// met de kleur uit palette.ts. Zo kan Yorrit tegels één voor één vervangen,
// zonder andere code aan te raken.
//
// import.meta.glob is een functie van Vite: bij het bouwen zoekt Vite alle
// bestanden die op het patroon passen. Met '?inline' wordt elke afbeelding een
// "data:"-URL in de code zelf, zodat ze ook offline en bij het printen klaarstaat.

const FILES = import.meta.glob('./{floor,props}/*.{svg,png,webp,jpg,jpeg}', {
  eager: true,
  query: '?inline',
  import: 'default',
}) as Record<string, string>;

export type TileKind = 'floor' | 'props';

const INDEX: Record<TileKind, Record<string, string>> = { floor: {}, props: {} };
for (const [path, url] of Object.entries(FILES)) {
  const m = /^\.\/(floor|props)\/(.+)\.[a-z]+$/.exec(path);
  if (m) INDEX[m[1] as TileKind][m[2]] = url;
}

/** De afbeelding voor een tegel, of undefined als er (nog) geen is. */
export function tileImage(kind: TileKind, id: string): string | undefined {
  return INDEX[kind][id];
}

/** Alle tegel-id's met een afbeelding (handig om te tonen wat er al is). */
export function tilesWithImage(kind: TileKind): string[] {
  return Object.keys(INDEX[kind]).sort();
}
