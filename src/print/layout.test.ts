import { describe, expect, it } from 'vitest';
import {
  CELL_MM, LABEL_MM, MARGIN_MM, cellsPerSheet, mapOrigin, planSheets, planSummary, splitEven,
} from './layout';

describe('printindeling (F16)', () => {
  it('past 7 × 11 vakjes op A4 staand en 11 × 7 liggend', () => {
    expect(cellsPerSheet('A4', 'portrait')).toEqual({ cols: 7, rows: 11 });
    expect(cellsPerSheet('A4', 'landscape')).toEqual({ cols: 11, rows: 7 });
    expect(cellsPerSheet('A3', 'landscape')).toEqual({ cols: 16, rows: 11 });
  });

  it('verdeelt eerlijk', () => {
    expect(splitEven(10, 2)).toEqual([5, 5]);
    expect(splitEven(11, 2)).toEqual([6, 5]);
    expect(splitEven(24, 4)).toEqual([6, 6, 6, 6]);
  });

  it('de stal (10 × 10) past op 2 A4-bladen, zonder reepjes', () => {
    const plan = planSheets({ c0: 0, r0: 0, cols: 10, rows: 10 }, 'A4');
    expect(plan.sheets).toHaveLength(2);
    expect(plan.orientation).toBe('portrait'); // gelijkspel -> staand
    expect(plan.sheets.map((s) => [s.c0, s.cols])).toEqual([[0, 5], [5, 5]]);
  });

  it('het dorp (24 × 18): 8 × A4 of 4 × A3 (liggend)', () => {
    const range = { c0: 0, r0: 0, cols: 24, rows: 18 };
    expect(planSheets(range, 'A4').sheets).toHaveLength(8);
    const a3 = planSheets(range, 'A3');
    expect(a3.sheets).toHaveLength(4);
    expect(a3.orientation).toBe('landscape');
  });

  it('bedekt elk vakje precies één keer, ook met een vaste richting', () => {
    const range = { c0: 2, r0: 3, cols: 23, rows: 17 };
    for (const orient of ['portrait', 'landscape'] as const) {
      const plan = planSheets(range, 'A4', orient);
      const seen = new Map<string, number>();
      for (const s of plan.sheets) {
        expect(s.cols).toBeLessThanOrEqual(plan.perCols);
        expect(s.rows).toBeLessThanOrEqual(plan.perRows);
        for (let r = s.r0; r < s.r0 + s.rows; r++) {
          for (let c = s.c0; c < s.c0 + s.cols; c++) seen.set(`${c},${r}`, (seen.get(`${c},${r}`) ?? 0) + 1);
        }
      }
      expect(seen.size).toBe(23 * 17);
      expect([...seen.values()].every((n) => n === 1)).toBe(true);
    }
  });

  it('de kaart blijft binnen de marges van het blad', () => {
    for (const paper of ['A4', 'A3'] as const) {
      for (const orient of ['portrait', 'landscape'] as const) {
        const plan = planSheets({ c0: 0, r0: 0, cols: 40, rows: 40 }, paper, orient);
        for (const s of plan.sheets) {
          const o = mapOrigin(plan, s);
          expect(o.x - LABEL_MM).toBeGreaterThanOrEqual(MARGIN_MM);
          expect(o.y - LABEL_MM).toBeGreaterThanOrEqual(MARGIN_MM);
          expect(o.x + s.cols * CELL_MM).toBeLessThanOrEqual(plan.pageW - MARGIN_MM);
          expect(o.y + s.rows * CELL_MM).toBeLessThanOrEqual(plan.pageH - MARGIN_MM);
        }
      }
    }
  });

  it('geeft een leesbare samenvatting', () => {
    const range = { c0: 0, r0: 0, cols: 10, rows: 10 };
    expect(planSummary(planSheets(range, 'A4'), range)).toBe(
      '2 bladen A4 staand (2 naast, 1 onder elkaar), kaart 25 × 25 cm',
    );
    const small = { c0: 0, r0: 0, cols: 3, rows: 3 };
    expect(planSummary(planSheets(small, 'A4'), small)).toBe('1 blad A4 staand, kaart 7,5 × 7,5 cm');
  });
});
