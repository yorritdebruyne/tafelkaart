// Kleine wrapper rond localStorage. Die kan in een privévenster ontbreken of een
// fout gooien, dus alles zit in try/catch en de app werkt ook zonder.

import { cellInBounds } from '../coords';
import { parseMapText } from '../schema';
import { createState, type MapState } from '../state';

/**
 * Versie van wat we bewaren. Verhoog dit als de app meer uit de kaart-JSON
 * leest dan vroeger: dan wordt een oude bewaarde kaart opnieuw ingelezen.
 *   1 (of ontbrekend) = M1: zonder props en regions
 *   2 = M2
 */
export const SAVE_FORMAT = 2;

const STATE_KEY = 'tafelkaart.v1.state';
const THEME_KEY = 'tafelkaart.v1.theme';

export interface Saved {
  /** De JSON-tekst waarmee de kaart geladen werd (om te herkennen of de hash dezelfde kaart is). */
  source: string;
  state: MapState;
  format?: number;
}

export function saveState(saved: Saved): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...saved, format: SAVE_FORMAT }));
  } catch {
    /* geen opslag beschikbaar */
  }
}

export function loadState(): Saved | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (!saved?.state?.map?.tokens || typeof saved.source !== 'string') return null;
    return upgradeSaved(saved);
  } catch {
    return null;
  }
}

/**
 * Bewaard door een oudere versie van de app? Dan lezen we de kaart opnieuw in
 * uit de bewaarde JSON-tekst (zodat bv. props en regions er nu wel in zitten),
 * en zetten we de tokens terug op hun bewaarde plek met hun afgelegde weg.
 */
export function upgradeSaved(saved: Saved): Saved | null {
  if (saved.format === SAVE_FORMAT) return saved;
  const res = parseMapText(saved.source);
  if (!res.map) return null;
  const fresh = createState(res.map);
  const { cols, rows } = fresh.map;
  const old = new Map(saved.state.map.tokens.map((t) => [t.id, t]));
  const paths = { ...fresh.paths };
  const tokens = fresh.map.tokens.map((t) => {
    const o = old.get(t.id);
    if (!o || !cellInBounds(o.cell, cols, rows, t.size)) return t;
    const path = saved.state.paths?.[t.id];
    if (path?.length) paths[t.id] = path;
    return { ...t, cell: o.cell };
  });
  return {
    source: saved.source,
    state: { ...fresh, map: { ...fresh.map, tokens }, paths },
    format: SAVE_FORMAT,
  };
}

const SFEER_KEY = 'tafelkaart.v1.sfeer';

/** Sfeer van de tegels (standaard, rijk, verlaten, ...). */
export function saveSfeer(name: string): void {
  try {
    localStorage.setItem(SFEER_KEY, name);
  } catch {
    /* geen opslag beschikbaar */
  }
}

export function loadSfeer(): string | null {
  try {
    return localStorage.getItem(SFEER_KEY);
  } catch {
    return null;
  }
}

export type Theme = 'auto' | 'light' | 'dark';

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* geen opslag beschikbaar */
  }
}

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}
