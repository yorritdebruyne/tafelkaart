import { describe, expect, it } from 'vitest';
import { parseMapObject, parseMapText } from './schema';
import { TEST_MAP, TEST_VILLAGE } from './testmap';

const base = { type: 'map', version: 1, name: 'Test', cols: 10, rows: 10 };

describe('schema', () => {
  it('de testkaart (stal) laadt zonder fouten', () => {
    const res = parseMapText(TEST_MAP);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.map?.tokens.map((t) => t.id)).toEqual(['Ak', 'Am', 'P', 'T1', 'T2']);
    expect(res.map?.walls).toHaveLength(6);
    expect(res.map?.doors[0]).toMatchObject({ id: 'zadel', side: 'W', state: 'closed' });
    expect(res.map?.regions).toEqual([{ id: 'zadelkamer', rect: { c1: 7, r1: 5, c2: 9, r2: 7 }, hidden: true }]);
    expect(res.notes).toEqual([]);
    expect(res.map?.terrain).toHaveLength(2);
    expect(res.map?.lights).toEqual([{ cell: { c: 4, r: 8 }, radius: 3, color: '#b48cff' }]);
  });

  it('regio zonder hidden is verborgen; fout gebied geeft een melding', () => {
    const res = parseMapObject({
      ...base,
      regions: [{ id: 'a', area: 'A1:B2' }, { id: 'b', area: 'A1:Z2' }, { id: 'a', cell: 'C3' }, { area: 'A1' }],
    });
    expect(res.map?.regions).toEqual([{ id: 'a', rect: { c1: 0, r1: 0, c2: 1, r2: 1 }, hidden: true }]);
    expect(res.errors).toEqual([
      'regions[1]: "A1:Z2" valt (deels) buiten de kaart (10×10)',
      'regions[2].id: "a" bestaat al, regio overgeslagen',
      'regions[3].id: ontbreekt',
    ]);
  });

  it('de testkaart (dorp) laadt zonder fouten of waarschuwingen', () => {
    const res = parseMapText(TEST_VILLAGE);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.map?.props.length).toBeGreaterThan(30);
  });

  it('JSON met tekst errond (```json uit de chat) werkt ook', () => {
    const res = parseMapText('Hier is de kaart:\n```json\n' + TEST_MAP + '\n```');
    expect(res.map?.name).toBe('Stal');
  });

  it('kapotte JSON geeft een duidelijke fout', () => {
    const res = parseMapText('{ "type": "map", ');
    expect(res.map).toBeNull();
    expect(res.errors[0]).toMatch(/^Geen geldige JSON/);
  });

  it('fout punt in een muur: melding met veld, rest wordt getekend', () => {
    const res = parseMapObject({
      ...base,
      walls: [
        { tile: 'stone', path: [[0, 0], [10, 0]] },
        { tile: 'stone', path: [[0, 0], [12, 4]] },
      ],
    });
    expect(res.errors).toEqual([
      'walls[1]: onbekend punt [12, 4] (hoekpunten lopen van [0, 0] tot [10, 10])',
    ]);
    expect(res.map?.walls).toHaveLength(1);
  });

  it('ontbrekend veld en buiten de kaart', () => {
    const res = parseMapObject({
      ...base,
      tokens: [
        { id: 'A', side: 'player' },
        { id: 'B', side: 'enemy', cell: 'K1' },
        { id: 'C', side: 'monster', cell: 'A1' },
        { id: 'D', side: 'npc', cell: 'J10', size: 2 },
        { id: 'E', side: 'npc', cell: 'B2' },
      ],
    });
    expect(res.errors).toEqual([
      'tokens[0].cell: ontbreekt',
      'tokens[1].cell: "K1" ligt buiten de kaart (10×10)',
      'tokens[2].side: moet "player" of "enemy" of "npc" zijn',
      'tokens[3].cell: "J10" ligt buiten de kaart (10×10) (token van 2×2)',
    ]);
    expect(res.map?.tokens.map((t) => t.id)).toEqual(['E']);
  });

  it('onbekende tegel: geen crash, wel een waarschuwing', () => {
    const res = parseMapObject({ ...base, floor: [{ tile: 'marmer', area: 'A1:C3' }] });
    expect(res.errors).toEqual([]);
    expect(res.warnings[0]).toContain('marmer');
    expect(res.map?.floor).toHaveLength(1);
  });

  it('onbekende velden worden genegeerd', () => {
    const res = parseMapObject({ ...base, weer: 'regen', tokens: [{ id: 'A', side: 'player', cell: 'A1', kleur: 'roze' }] });
    expect(res.errors).toEqual([]);
    expect(res.map?.tokens[0]).not.toHaveProperty('kleur');
  });

  it('een patch is geen kaart', () => {
    const res = parseMapObject({ type: 'patch', version: 1, map: 'Stal' });
    expect(res.map).toBeNull();
    expect(res.errors[0]).toContain('patch');
  });

  it('kop fout: geen kaart', () => {
    const res = parseMapObject({ type: 'map', version: 1, name: 'X', cols: 10 });
    expect(res.map).toBeNull();
    expect(res.errors).toEqual(['rows: ontbreekt']);
  });

  it('deur met Engelse kant (E) wordt O', () => {
    const res = parseMapObject({ ...base, doors: [{ cell: 'A1', side: 'E' }, { cell: 'A1', side: 'X' }] });
    expect(res.map?.doors[0]).toMatchObject({ side: 'O', state: 'closed', tile: 'door-wood' });
    expect(res.errors).toEqual(['doors[1].side: moet N, O, Z of W zijn (niet "X")']);
  });
});
