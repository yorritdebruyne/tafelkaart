// De toestand van de app: de kaart (met de huidige posities) en per token
// de weg die het sinds het begin van zijn beurt heeft afgelegd.
//
// We passen de state nooit "in place" aan: elke functie geeft een NIEUW object
// terug (zoals final-velden in Java). Dat maakt undo later (M3) eenvoudig:
// je bewaart gewoon de oude objecten op een stapel.

import type { Cell } from './coords';
import { isCellHidden } from './fog';
import type { DoorState, MapData, TokenItem } from './schema';
import { cellEdge } from './coords';

export interface MapState {
  map: MapData;
  /** Per token-id: de vakjes sinds het begin van de beurt. paths[id][0] = startvakje. */
  paths: Record<string, Cell[]>;
  /** Vingerafdrukken van de patches die al toegepast zijn (zelfde patch twee keer = niets doen). */
  patches: string[];
  /** Deuren die spelers zelf open- of dichtdeden sinds de laatste "Nieuwe beurt" (voor de DM). */
  doorNotes?: Record<string, DoorState>;
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
  // Nieuwe beurt voor iedereen: de deur-meldingen zijn doorgegeven.
  return id === undefined ? { ...state, paths, doorNotes: {} } : { ...state, paths };
}

/**
 * Een speler opent of sluit een deur (tik). Alleen gewone deuren en poorten, niet op slot,
 * en niet als de deur volledig in de mist ligt (dan zie je ze niet).
 * Geeft dezelfde state terug als er niets mag veranderen.
 */
export function toggleDoor(state: MapState, id: string): MapState {
  const door = state.map.doors.find((d) => d.id === id);
  if (!door || door.state === 'locked' || door.tile === 'window' || door.tile === 'arch') return state;
  const e = cellEdge(door.cell, door.side);
  const other = { c: door.cell.c - e.nx, r: door.cell.r - e.ny };
  if (isCellHidden(state.map, door.cell) && isCellHidden(state.map, other)) return state;
  return setDoorState(state, id, door.state === 'open' ? 'closed' : 'open');
}

/** Een deur die een speler opende of sloot op een ander toestel (zie ui/sync.ts). */
export function setDoorState(state: MapState, id: string, next: DoorState): MapState {
  if (!state.map.doors.some((d) => d.id === id)) return state;
  return {
    ...state,
    map: { ...state.map, doors: state.map.doors.map((d) => (d.id === id ? { ...d, state: next } : d)) },
    doorNotes: { ...state.doorNotes, [id]: next },
  };
}
