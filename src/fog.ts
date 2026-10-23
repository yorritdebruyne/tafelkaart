// Fog of war (F11): welke vakjes zijn verborgen?
//
// Een regio met hidden = true bedekt een rechthoek met mist. Een patch kan ze
// zichtbaar maken met "reveal". Overlappen twee regio's, dan blijft een vakje
// verborgen zolang één van beide nog verborgen is.
//
// Spelers-tokens zijn altijd zichtbaar (je weet waar je eigen personage staat).
// Vijanden en npc's die volledig in de mist staan, tekenen we niet en komen ook
// niet in "Kopieer posities": anders zou de app iets verklappen.

import type { Cell } from './coords';
import type { MapData, TokenItem } from './schema';

export function isCellHidden(map: MapData, cell: Cell): boolean {
  return map.regions.some(
    (g) => g.hidden && cell.c >= g.rect.c1 && cell.c <= g.rect.c2 && cell.r >= g.rect.r1 && cell.r <= g.rect.r2,
  );
}

/** Verborgen = een vijand of npc waarvan ALLE vakjes in de mist liggen. */
export function isTokenHidden(map: MapData, token: TokenItem): boolean {
  if (token.side === 'player') return false;
  for (let dr = 0; dr < token.size; dr++) {
    for (let dc = 0; dc < token.size; dc++) {
      if (!isCellHidden(map, { c: token.cell.c + dc, r: token.cell.r + dr })) return false;
    }
  }
  return true;
}

/** De tokens die je mag zien (en mag kopiëren). */
export function visibleTokens(map: MapData): TokenItem[] {
  return map.tokens.filter((t) => !isTokenHidden(map, t));
}
