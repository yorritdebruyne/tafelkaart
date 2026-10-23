// Schaakbordcoördinaten: "E9" <-> { c: 4, r: 8 }.
// c = kolom (0 = A), r = rij (0 = rij 1). Na Z komt AA, AB, ... (zoals in Excel).

/** Eén vakje op het grid. */
export interface Cell {
  c: number;
  r: number;
}

/** Rechthoek van vakjes, beide hoeken inbegrepen ("A1:J8"). */
export interface Rect {
  c1: number;
  r1: number;
  c2: number;
  r2: number;
}

/** Kant van een vakje: Noord, Oost, Zuid, West. */
export type EdgeSide = 'N' | 'O' | 'Z' | 'W';

export function colToLetters(c: number): string {
  let n = c + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const CELL_RE = /^([A-Z]{1,3})(\d{1,3})$/;

/** "E9" -> { c: 4, r: 8 }. Geeft null bij iets dat geen vakje is. */
export function parseCell(text: string): Cell | null {
  const m = CELL_RE.exec(text.trim().toUpperCase());
  if (!m) return null;
  const r = Number(m[2]) - 1;
  if (r < 0) return null;
  return { c: lettersToCol(m[1]), r };
}

/** { c: 4, r: 8 } -> "E9" */
export function formatCell(cell: Cell): string {
  return colToLetters(cell.c) + String(cell.r + 1);
}

/** "A1:J8" -> rechthoek. Een los vakje ("E9") mag ook. Hoeken mogen in elke volgorde. */
export function parseArea(text: string): Rect | null {
  const parts = text.split(':');
  if (parts.length > 2) return null;
  const a = parseCell(parts[0]);
  const b = parts.length === 2 ? parseCell(parts[1]) : a;
  if (!a || !b) return null;
  return {
    c1: Math.min(a.c, b.c),
    r1: Math.min(a.r, b.r),
    c2: Math.max(a.c, b.c),
    r2: Math.max(a.r, b.r),
  };
}

export function formatArea(rect: Rect): string {
  return `${formatCell({ c: rect.c1, r: rect.r1 })}:${formatCell({ c: rect.c2, r: rect.r2 })}`;
}

/** Past een token van `size` × `size` vakjes met linkerbovenhoek `cell` op de kaart? */
export function cellInBounds(cell: Cell, cols: number, rows: number, size = 1): boolean {
  return cell.c >= 0 && cell.r >= 0 && cell.c + size <= cols && cell.r + size <= rows;
}

export function rectInBounds(rect: Rect, cols: number, rows: number): boolean {
  return rect.c1 >= 0 && rect.r1 >= 0 && rect.c2 < cols && rect.r2 < rows;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.c === b.c && a.r === b.r;
}

/** Afstand in vakjes volgens de 2024-regels: diagonaal telt als 1. */
export function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
}

/**
 * De rand van een vakje, in grid-eenheden (1 = één vakje).
 * (nx, ny) wijst van de rand naar het midden van het vakje (handig om een open deur te tekenen).
 */
export function cellEdge(cell: Cell, side: EdgeSide) {
  const { c, r } = cell;
  switch (side) {
    case 'N': return { x1: c, y1: r, x2: c + 1, y2: r, nx: 0, ny: 1 };
    case 'Z': return { x1: c, y1: r + 1, x2: c + 1, y2: r + 1, nx: 0, ny: -1 };
    case 'W': return { x1: c, y1: r, x2: c, y2: r + 1, nx: 1, ny: 0 };
    case 'O': return { x1: c + 1, y1: r, x2: c + 1, y2: r + 1, nx: -1, ny: 0 };
  }
}
