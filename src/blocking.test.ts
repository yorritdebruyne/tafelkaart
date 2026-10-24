import { afterEach, describe, expect, it } from 'vitest';
import { buildAllBlockers } from './blocking';
import { parseCell } from './coords';
import { canStep } from './movement';
import { positionsText } from './rules';
import { parseMapObject, parseMapText } from './schema';
import { createState, newTurn, toggleDoor } from './state';
import { TEST_VILLAGE } from './testmap';
import { setFaIndex } from './tiles';

const c = (t: string) => parseCell(t)!;
const base = { type: 'map', version: 1, name: 'X', cols: 8, rows: 8 };

describe('grote props houden tegen', () => {
  afterEach(() => setFaIndex(undefined));

  it('kar en put blokkeren, bloemen en tapijt niet', () => {
    const map = parseMapObject({
      ...base,
      props: [{ tile: 'cart', area: 'C3:D5' }, { tile: 'flowers', cell: 'F2' }, { tile: 'rug', area: 'F5:G6' }],
    }).map!;
    const b = buildAllBlockers(map);
    expect(canStep(b, c('B4'), c('C4'))).toBe(false);
    expect(canStep(b, c('E2'), c('F2'))).toBe(true);
    expect(canStep(b, c('E5'), c('F5'))).toBe(true);
    // Eruit stappen mag (als de DM je er toch op zette).
    expect(canStep(b, c('C4'), c('B4'))).toBe(true);
  });

  it('FA-trog van 2×1 op één vakje blokkeert ook het vakje ernaast', () => {
    setFaIndex({ pxPerCell: 200, themes: {}, props: { trough: [['T/Trough_A_2x1.png', 2, 1]] }, floor: {} });
    const map = parseMapObject({ ...base, props: [{ tile: 'trough', cell: 'C7' }] }).map!;
    const b = buildAllBlockers(map);
    expect(canStep(b, c('C6'), c('C7'))).toBe(false);
    expect(canStep(b, c('D6'), c('D7'))).toBe(false);
    expect(canStep(b, c('E6'), c('E7'))).toBe(true);
  });

  it('boom: alleen de stam (midden) houdt tegen', () => {
    const map = parseMapObject({ ...base, props: [{ tile: 'tree', area: 'B2:D4' }] }).map!;
    const b = buildAllBlockers(map);
    expect(canStep(b, c('A3'), c('B3'))).toBe(true);
    expect(canStep(b, c('B3'), c('C3'))).toBe(false);
  });

  it('props in de mist houden niet tegen', () => {
    const map = parseMapObject({
      ...base, props: [{ tile: 'barrel', cell: 'C3' }], regions: [{ id: 'r', area: 'C3:D4' }],
    }).map!;
    expect(canStep(buildAllBlockers(map), c('B3'), c('C3'))).toBe(true);
  });

  it('dorp: niet over de kar of de put', () => {
    const b = buildAllBlockers(parseMapText(TEST_VILLAGE).map!);
    expect(canStep(b, c('L12'), c('M12'))).toBe(false); // kar M11:N13
    expect(canStep(b, c('H7'), c('I7'))).toBe(false); // put I7:J8
  });
});

describe('deuren zelf openen', () => {
  const map = () => parseMapObject({
    ...base,
    doors: [
      { id: 'a', cell: 'B2', side: 'N', state: 'closed' },
      { id: 'b', cell: 'C2', side: 'N', state: 'locked' },
      { id: 'r', tile: 'window', cell: 'D2', side: 'N' },
      { id: 'm', cell: 'F6', side: 'N', state: 'closed' },
    ],
    regions: [{ id: 'mist', area: 'F5:G7' }],
  }).map!;

  it('tik: dicht -> open -> dicht; melding voor de DM tot de nieuwe beurt', () => {
    let s = createState(map());
    s = toggleDoor(s, 'a');
    expect(s.map.doors[0].state).toBe('open');
    expect(positionsText([], s.doorNotes)).toBe('Posities:  (deur a open)');
    s = toggleDoor(s, 'a');
    expect(s.map.doors[0].state).toBe('closed');
    expect(s.doorNotes).toEqual({ a: 'closed' });
    expect(newTurn(s).doorNotes).toEqual({});
  });

  it('op slot, raam, of volledig in de mist: niets', () => {
    const s = createState(map());
    expect(toggleDoor(s, 'b')).toBe(s);
    expect(toggleDoor(s, 'r')).toBe(s);
    expect(toggleDoor(s, 'm')).toBe(s);
  });
});
