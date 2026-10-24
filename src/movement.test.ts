import { describe, expect, it } from 'vitest';
import { parseCell } from './coords';
import { buildBlockers, canStep, isOccupied, landingIndex, stepsBetween } from './movement';
import { applyPatch } from './patch';
import { parseMapText } from './schema';
import { createState } from './state';
import { TEST_MAP } from './testmap';

const c = (t: string) => parseCell(t)!;
const stal = () => createState(parseMapText(TEST_MAP).map!);

describe('muren en deuren', () => {
  const b = buildBlockers(stal().map);

  it('door de opening in de staldeur (E en F) mag, ernaast niet', () => {
    expect(canStep(b, c('E9'), c('E8'))).toBe(true);
    expect(canStep(b, c('F9'), c('F8'))).toBe(true);
    expect(canStep(b, c('D9'), c('D8'))).toBe(false);
    expect(canStep(b, c('G9'), c('G8'))).toBe(false);
  });

  it('diagonaal rond het uiteinde van een muur mag, schuin door een muur niet', () => {
    expect(canStep(b, c('E9'), c('D8'))).toBe(true); // via E8
    expect(canStep(b, c('D9'), c('C8'))).toBe(false);
  });

  it('dichte deur houdt tegen, open deur niet', () => {
    expect(canStep(b, c('G7'), c('H7'))).toBe(false);
    const open = applyPatch(stal(), { type: 'patch', version: 1, map: 'Stal', doors: { zadel: { state: 'open' } } });
    expect(canStep(buildBlockers(open.state.map), c('G7'), c('H7'))).toBe(true);
  });

  it('niet schuin langs de deur de zadelkamer in glippen', () => {
    expect(canStep(b, c('G7'), c('H6'))).toBe(false);
    expect(canStep(b, c('G7'), c('H8'))).toBe(false);
  });

  it('buitenmuur: niet van de kaart af', () => {
    expect(canStep(b, c('A5'), c('B5'))).toBe(true);
    expect(canStep(b, c('J9'), c('J8'))).toBe(false);
  });

  it('2×2-token: de hele voorkant moet vrij zijn', () => {
    // 2×2 op D9 (D9:E10) naar boven: D-kolom zit tegen de muur.
    expect(canStep(b, c('D9'), c('D8'), 2)).toBe(false);
    expect(canStep(b, c('E9'), c('E8'), 2)).toBe(true); // E9:F10 past door de opening
  });

  it('stap voor stap bij snel slepen', () => {
    expect(stepsBetween(c('A1'), c('D2'))).toEqual([c('B1'), c('C2'), c('D2')]);
  });
});

describe('niet op elkaar', () => {
  it('eindigen op een ander token mag niet, ervoor blijven staan wel', () => {
    const { map } = stal();
    expect(isOccupied(map, c('F9'), 1, 'Ak')).toBe(true); // Amara
    expect(isOccupied(map, c('E9'), 1, 'Ak')).toBe(false); // jezelf telt niet
    const path = [c('D9'), c('E9'), c('F9')];
    expect(landingIndex(map, path, 1, 'X')).toBe(0);
    expect(landingIndex(map, [c('E8'), c('F8'), c('F9')], 1, 'Ak')).toBe(1);
  });

  it('verborgen token in de mist telt niet mee (anders verklapt het iets)', () => {
    const s = applyPatch(stal(), { type: 'patch', version: 1, map: 'Stal', tokens: { T5: { add: { side: 'enemy', cell: 'I7' } } } }).state;
    expect(isOccupied(s.map, c('I7'), 1, 'Ak')).toBe(false);
  });

  it('2×2 overlapt een 1×1', () => {
    expect(isOccupied(stal().map, c('E8'), 2, 'X')).toBe(true); // E8:F9 raakt Ak en Am
  });
});
