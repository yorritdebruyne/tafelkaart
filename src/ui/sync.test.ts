import { describe, expect, it } from 'vitest';
import { parseMapText } from '../schema';
import { createState, getToken } from '../state';
import { TEST_MAP, TEST_PATCH } from '../testmap';
import { applySyncOp } from './sync';

describe('stappen van een ander toestel (applySyncOp)', () => {
  const stal = () => createState(parseMapText(TEST_MAP).map!);

  it('verplaatsen, deur, beurt en patch geven hetzelfde als zelf doen', () => {
    let s = stal();
    s = applySyncOp(s, { kind: 'move', id: 'Ak', path: [{ c: 4, r: 8 }, { c: 3, r: 8 }] });
    expect(getToken(s, 'Ak')!.cell).toEqual({ c: 3, r: 8 });
    s = applySyncOp(s, { kind: 'door', id: 'zadel', state: 'open' });
    expect(s.map.doors[0].state).toBe('open');
    expect(s.doorNotes).toEqual({ zadel: 'open' });
    s = applySyncOp(s, { kind: 'turn' });
    expect(s.paths.Ak).toEqual([{ c: 3, r: 8 }]);
    s = applySyncOp(s, { kind: 'patch', value: JSON.parse(TEST_PATCH) });
    expect(getToken(s, 'T2')).toBeUndefined();
    // Dezelfde patch nog eens (bv. na herverbinden): niets.
    expect(applySyncOp(s, { kind: 'patch', value: JSON.parse(TEST_PATCH) })).toBe(s);
  });

  it('negeert stappen voor tokens of deuren die er niet zijn', () => {
    const s = stal();
    expect(applySyncOp(s, { kind: 'move', id: 'X', path: [{ c: 0, r: 0 }] })).toBe(s);
    expect(applySyncOp(s, { kind: 'door', id: 'nope', state: 'open' })).toBe(s);
  });
});
