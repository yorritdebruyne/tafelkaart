// Tests voor de bemerkingen uit de testfase: tegelnamen, huifkar, in de kast kruipen.

import { describe, expect, it } from 'vitest';
import { buildAllBlockers } from './blocking';
import { parseCell } from './coords';
import { canStep } from './movement';
import { pathCost, positionsText } from './rules';
import { parseMapObject } from './schema';
import { insideOf } from './terrain';
import { pickProp, type PropEntry } from './tiles/fa';

const c = (t: string) => parseCell(t)!;
const base = { type: 'map', version: 1, name: 'Test', cols: 10, rows: 10 };

describe('tegelnamen', () => {
  it('"Rug", "Weapon_Rack" en "carpet" (als prop) worden bekende tegels, met een info-melding', () => {
    const res = parseMapObject({
      ...base,
      props: [{ tile: 'Rug', area: 'B2:C3' }, { tile: 'Weapon_Rack', cell: 'E1' }, { tile: 'carpet', cell: 'G5' }],
      floor: [{ tile: 'Grass', area: 'A1:J10' }],
    });
    expect(res.warnings).toEqual([]);
    expect(res.map?.props.map((p) => p.tile)).toEqual(['rug', 'weapon-rack', 'rug']);
    expect(res.map?.floor[0].tile).toBe('grass');
    expect(res.notes.some((n) => n.includes('"Rug" gelezen als "rug"'))).toBe(true);
  });
});

describe('huifkar', () => {
  const cands: PropEntry[] = [['Cart_Wood_A1_2x3.png', 2, 3], ['Wagon_Wood_Ashen_A1_3x6.png', 3, 6]];
  it('cart: klein vak = handkar, groot vak = wagen', () => {
    expect(pickProp(cands, 2, 3, 's')?.path).toContain('Cart_');
    expect(pickProp(cands, 3, 6, 's')?.path).toContain('Wagon_');
  });

  it('wagon is een gekende tegel', () => {
    const res = parseMapObject({ ...base, props: [{ tile: 'wagon', area: 'A1:C6' }] });
    expect(res.warnings).toEqual([]);
  });
});

describe('in de kast kruipen', () => {
  const res = parseMapObject({
    ...base,
    walls: [{ path: [[0, 0], [10, 0]] }],
    props: [{ tile: 'cupboard', area: 'C1:D1' }],
    tokens: [{ id: 'Am', name: 'Amara', side: 'player', cell: 'C2' }],
  });
  const map = res.map!;
  const am = map.tokens[0];

  it('een kast houdt niet tegen; erin kruipen kost 1 extra', () => {
    expect(canStep(buildAllBlockers(map), c('C2'), c('C1'))).toBe(true);
    expect(pathCost(map, am, [c('C2'), c('C1')])).toBe(2);
  });

  it('"Kopieer posities" zegt dat je in de kast zit', () => {
    const inKast = { ...am, cell: c('C1') };
    expect(insideOf(map, inKast)).toBe('de kast');
    expect(positionsText([inKast], {}, (t) => insideOf(map, t))).toBe('Posities: Amara: C1 (in de kast)');
  });
});
