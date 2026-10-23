// Kleine wrapper rond localStorage. Die kan in een privévenster ontbreken of een
// fout gooien, dus alles zit in try/catch en de app werkt ook zonder.

import type { MapState } from '../state';

const STATE_KEY = 'tafelkaart.v1.state';
const THEME_KEY = 'tafelkaart.v1.theme';

export interface Saved {
  /** De JSON-tekst waarmee de kaart geladen werd (om te herkennen of de hash dezelfde kaart is). */
  source: string;
  state: MapState;
}

export function saveState(saved: Saved): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(saved));
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
    // Bewaard door een oudere versie (M1)? Dan ontbreken nieuwe velden: aanvullen.
    const s = saved.state as Partial<MapState> & { map: Partial<MapState['map']> };
    s.patches ??= [];
    s.paths ??= {};
    s.map.regions ??= [];
    return saved;
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
