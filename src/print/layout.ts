// Printmodus (F16): hoe verdelen we een kaart over bladen papier?
//
// Puur rekenwerk, zonder DOM (zoals een gewone functie in Python): makkelijk te testen.
// Eén vakje = precies 25 mm. Per blad houden we plaats vrij voor:
//   - een marge rond het blad (de meeste printers drukken niet tot de rand),
//   - een strook met letters bovenaan en cijfers links,
//   - een voettekst (bladnummer, welk stuk van de kaart).
// We verdelen de kolommen en rijen eerlijk over de bladen (10 kolommen op 2 bladen =
// 5 + 5, niet 7 + 3): dan heb je geen smalle reepjes om te plakken.

export type Paper = 'A4' | 'A3';
export type Orientation = 'portrait' | 'landscape';
export type OrientationChoice = Orientation | 'auto';

/** Eén vakje op papier, in millimeter. */
export const CELL_MM = 25;
/** Witte rand rond het blad. */
export const MARGIN_MM = 6;
/** Strook voor de coördinaten (letters boven, cijfers links). */
export const LABEL_MM = 4;
/** Strook voor de voettekst onder de kaart. */
export const FOOTER_MM = 5;

/** Papier staand, in mm (breedte × hoogte). */
export const PAPER_MM: Record<Paper, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
};

/** Een stuk van de kaart: kolom/rij linksboven (0 = A / rij 1) en hoeveel vakjes. */
export interface Range {
  c0: number;
  r0: number;
  cols: number;
  rows: number;
}

export interface Sheet extends Range {
  /** 0, 1, 2, ... in de volgorde van afdrukken (rij per rij, links naar rechts). */
  index: number;
  /** Plaats in de "puzzel" van bladen: rij en kolom, vanaf 0. */
  row: number;
  col: number;
}

export interface SheetPlan {
  paper: Paper;
  orientation: Orientation;
  /** Paginagrootte in mm (al gedraaid voor liggend). */
  pageW: number;
  pageH: number;
  /** Hoeveel vakjes er maximaal op één blad passen. */
  perCols: number;
  perRows: number;
  /** Aantal bladen naast en onder elkaar. */
  across: number;
  down: number;
  sheets: Sheet[];
}

export function pageSize(paper: Paper, orientation: Orientation): { w: number; h: number } {
  const p = PAPER_MM[paper];
  return orientation === 'portrait' ? { w: p.w, h: p.h } : { w: p.h, h: p.w };
}

/** Hoeveel vakjes passen er op één blad? */
export function cellsPerSheet(paper: Paper, orientation: Orientation): { cols: number; rows: number } {
  const { w, h } = pageSize(paper, orientation);
  return {
    cols: Math.floor((w - 2 * MARGIN_MM - LABEL_MM) / CELL_MM),
    rows: Math.floor((h - 2 * MARGIN_MM - LABEL_MM - FOOTER_MM) / CELL_MM),
  };
}

/** `total` eerlijk verdelen over `parts` stukken: 10 over 2 = [5, 5], 11 over 2 = [6, 5]. */
export function splitEven(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

function planFor(range: Range, paper: Paper, orientation: Orientation): SheetPlan {
  const per = cellsPerSheet(paper, orientation);
  const across = Math.max(1, Math.ceil(range.cols / per.cols));
  const down = Math.max(1, Math.ceil(range.rows / per.rows));
  const widths = splitEven(range.cols, across);
  const heights = splitEven(range.rows, down);
  const sheets: Sheet[] = [];
  let r0 = range.r0;
  for (let row = 0; row < down; row++) {
    let c0 = range.c0;
    for (let col = 0; col < across; col++) {
      sheets.push({ index: sheets.length, row, col, c0, r0, cols: widths[col], rows: heights[row] });
      c0 += widths[col];
    }
    r0 += heights[row];
  }
  const { w, h } = pageSize(paper, orientation);
  return { paper, orientation, pageW: w, pageH: h, perCols: per.cols, perRows: per.rows, across, down, sheets };
}

/**
 * De bladen voor een stuk van de kaart (of de hele kaart).
 * Met 'auto' kiezen we de richting met de minste bladen; bij gelijkspel staand.
 */
export function planSheets(range: Range, paper: Paper, choice: OrientationChoice = 'auto'): SheetPlan {
  if (choice !== 'auto') return planFor(range, paper, choice);
  const portrait = planFor(range, paper, 'portrait');
  const landscape = planFor(range, paper, 'landscape');
  return landscape.sheets.length < portrait.sheets.length ? landscape : portrait;
}

/**
 * Waar staat de kaart op het blad (in mm vanaf linksboven)? We centreren het blok
 * (coördinaten + kaart + voettekst), maar nooit dichter bij de rand dan de marge.
 */
export function mapOrigin(plan: SheetPlan, sheet: Range): { x: number; y: number } {
  const blockW = LABEL_MM + sheet.cols * CELL_MM;
  const blockH = LABEL_MM + sheet.rows * CELL_MM + FOOTER_MM;
  const x = Math.max(MARGIN_MM, (plan.pageW - blockW) / 2) + LABEL_MM;
  const y = Math.max(MARGIN_MM, (plan.pageH - blockH) / 2) + LABEL_MM;
  return { x, y };
}

const NL_ORIENT: Record<Orientation, string> = { portrait: 'staand', landscape: 'liggend' };

/** Korte uitleg voor in de dialoog, bv. "2 bladen A4 staand (2 naast elkaar), kaart 25 × 25 cm". */
export function planSummary(plan: SheetPlan, range: Range): string {
  const n = plan.sheets.length;
  const grid = n === 1 ? '' : ` (${plan.across} naast, ${plan.down} onder elkaar)`;
  const cm = (cells: number) => String((cells * CELL_MM) / 10).replace('.', ',');
  return `${n} ${n === 1 ? 'blad' : 'bladen'} ${plan.paper} ${NL_ORIENT[plan.orientation]}${grid}, kaart ${cm(range.cols)} × ${cm(range.rows)} cm`;
}
