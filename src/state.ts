// De toestand van de app: de kaart (met de huidige posities) en per token
// de weg die het sinds het begin van zijn beurt heeft afgelegd.
//
// We passen de state nooit "in place" aan: elke functie geeft een NIEUW object
// terug (zoals final-velden in Java). Dat maakt undo later (M3) eenvoudig:
// je bewaart gewoon de oude objecten op een stapel.

import type { Cell } from './coords';
import type { MapData, TokenItem } from './schema';

export interface MapState {
  map: MapData;
  /** Per token-id: de vakjes sinds het begin van de beurt. paths[id][0] = startvakje. */
  paths: Record<string, Cell[]>;
  /** Vingerafdrukken van de patches die al toegepast zijn (zelfde patch twee keer = niets doen). */
  patches: string[];
}

export function createState(map: MapData): MapState {
  const paths: Record<string, Cell[]> = {};
  for (const t of map.tokens) paths[t.id] = [t.cell];
  return { map, paths, patches: [] };
}

export function getToken(state: MapState, id: string): TokenItem | undefined {
  return state.map.tokens.find((t) => t.id === id);
}

export function getPath(state: MapState, id: string): Cell[] {
  const token = getToken(state, id);
  const path = state.paths[id];
  return path && path.length ? path : token ? [token.cell] : [];
}

/** Zet een token op het laatste vakje van `path` en onthoud de afgelegde weg. */
export function moveToken(state: MapState, id: string, path: Cell[]): MapState {
  if (!path.length) return state;
  const end = path[path.length - 1];
  return {
    ...state,
    map: {
      ...state.map,
      tokens: state.map.tokens.map((t) => (t.id === id ? { ...t, cell: end } : t)),
    },
    paths: { ...state.paths, [id]: path },
  };
}

/** Nieuwe beurt: de teller begint opnieuw vanaf de huidige plek. Zonder id: voor iedereen. */
export function newTurn(state: MapState, id?: string): MapState {
  const paths = { ...state.paths };
  for (const t of state.map.tokens) {
    if (id === undefined || t.id === id) paths[t.id] = [t.cell];
  }
  return { ...state, paths };
}
