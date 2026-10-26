// Kleine wrapper rond localStorage. Die kan in een privévenster ontbreken of een
// fout gooien, dus alles zit in try/catch en de app werkt ook zonder.

import { cellInBounds } from '../coords';
import type { LightMode } from '../light';
import { parseMapText } from '../schema';
import { DEFAULT_PRINT, type PrintOptions } from '../print/options';
import { createState, type MapState } from '../state';

/**
 * Versie van wat we bewaren. Verhoog dit als de app meer uit de kaart-JSON
 * leest dan vroeger: dan wordt een oude bewaarde kaart opnieuw ingelezen.
 *   1 (of ontbrekend) = M1: zonder props en regions
 *   2 = M2
 *   3 = M3: met terrain, lights en condities uit de kaart
 */
export const SAVE_FORMAT = 3;

/** Ook gebruikt om te merken dat een ander venster (bv. de tv) de kaart veranderde. */
export const STATE_KEY = 'tafelkaart.v1.state';
const THEME_KEY = 'tafelkaart.v1.theme';
const PRINT_KEY = 'tafelkaart.v1.print';

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

const LIGHT_KEY = 'tafelkaart.v1.light';

/** Licht-knop (F13): auto, aan of uit. */
export function saveLight(mode: LightMode): void {
  try {
    localStorage.setItem(LIGHT_KEY, mode);
  } catch {
    /* geen opslag beschikbaar */
  }
}

export function loadLight(): LightMode {
  try {
    const m = localStorage.getItem(LIGHT_KEY);
    return m === 'aan' || m === 'uit' ? m : 'auto';
  } catch {
    return 'auto';
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

/** Printinstellingen (F16): papier, richting en vinkjes. Onbekende of kapotte waarden -> standaard. */
export function loadPrint(): PrintOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(PRINT_KEY) ?? '{}') as Partial<PrintOptions>;
    return {
      paper: raw.paper === 'A3' ? 'A3' : 'A4',
      orientation: raw.orientation === 'portrait' || raw.orientation === 'landscape' ? raw.orientation : 'auto',
      tokens: raw.tokens === true,
      inkSaver: raw.inkSaver === true,
      hiddenSheets: raw.hiddenSheets === true,
    };
  } catch {
    return { ...DEFAULT_PRINT };
  }
}

export function savePrint(opts: PrintOptions): void {
  try {
    localStorage.setItem(PRINT_KEY, JSON.stringify(opts));
  } catch {
    /* geen opslag beschikbaar */
  }
}
