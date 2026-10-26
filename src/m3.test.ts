// Tests voor M3: moeilijk terrein, licht en condities.

import { describe, expect, it } from 'vitest';
import { conditionLabel, effectiveSpeed } from './conditions';
import { parseCell } from './coords';
import { isDark, lightBlockers, lightSources, visibilityPolygon } from './light';
import { applyPatch } from './patch';
import { isOverSpeed, leftReach, pathCost, pathLength } from './rules';
import { parseMapObject, parseMapText, type MapData } from './schema';
import { createState } from './state';
import { terrainInfo } from './terrain';
import { TEST_MAP } from './testmap';

const c = (t: string) => parseCell(t)!;
const path = (...cells: string[]) => cells.map(c);
const base = { type: 'map', version: 1, name: 'Test', cols: 10, rows: 10 };
const load = (extra: object): MapData => {
  const res = parseMapObject({ ...base, ...extra });
  expect(res.errors).toEqual([]);
  return res.map!;
};
const tok = (map: MapData, id: string) => map.tokens.find((t) => t.id === id)!;

describe('terrain inlezen', () => {
  it('difficult wordt gelezen, een onbekende soort geeft een waarschuwing', () => {
    const res = parseMapObject({
      ...base,
      terrain: [{ kind: 'difficult', area: 'A1:B2' }, { kind: 'slippery', cell: 'C3' }, { kind: 'difficult', cell: 'Z9' }],
    });
    expect(res.map?.terrain).toEqual([{ kind: 'difficult', rect: { c1: 0, r1: 0, c2: 1, r2: 1 } }]);
    expect(res.warnings.some((w) => w.includes('terrain[1].kind'))).toBe(true);
    expect(res.errors.some((e) => e.startsWith('terrain[2]'))).toBe(true);
  });

  it('lights: standaardkleur en foute kleur', () => {
    const res = parseMapObject({ ...base, lights: [{ cell: 'B2', radius: 2 }, { cell: 'C3', radius: 1, color: 'paars' }] });
    expect(res.map?.lights.map((l) => l.color)).toEqual(['#ffc878', '#ffc878']);
    expect(res.warnings.some((w) => w.includes('lights[1].color'))).toBe(true);
  });

  it('condities mogen ook al in de kaart staan', () => {
    const map = load({ tokens: [{ id: 'A', side: 'player', cell: 'A1', conditions: ['prone'] }] });
    expect(tok(map, 'A').conditions).toEqual(['prone']);
  });
});

describe('bewegingskosten (F12)', () => {
  it('moeilijk terrein kost 1 extra per vakje, niet dubbel als het twee keer moeilijk is', () => {
    const map = load({
      terrain: [{ kind: 'difficult', area: 'B1:C1' }, { kind: 'difficult', cell: 'B1' }],
      tokens: [{ id: 'A', side: 'player', cell: 'A1', speed: 6 }],
    });
    const a = tok(map, 'A');
    expect(pathCost(map, a, path('A1', 'B1', 'C1', 'D1'))).toBe(5);
    expect(pathLength(path('A1', 'B1', 'C1', 'D1'))).toBe(3);
    // Je verlaat moeilijk terrein gratis: alleen het vakje waar je op stapt telt.
    expect(pathCost(map, a, path('C1', 'D1'))).toBe(1);
  });

  it('door een bondgenoot lopen = moeilijk terrein; puin, struik, water en ladder ook', () => {
    const map = load({
      floor: [{ tile: 'water-shallow', cell: 'E1' }],
      props: [{ tile: 'rubble', cell: 'C1' }, { tile: 'ladder', cell: 'G1' }],
      tokens: [{ id: 'A', side: 'player', cell: 'A1' }, { id: 'B', side: 'player', cell: 'B1' }],
    });
    const a = tok(map, 'A');
    const info = terrainInfo(map);
    expect(info.difficult.has('2,0')).toBe(true);
    expect(info.difficult.has('4,0')).toBe(true);
    expect(info.climb.has('6,0')).toBe(true);
    expect(pathCost(map, a, path('A1', 'B1'))).toBe(2); // bondgenoot
    expect(pathCost(map, a, path('B1', 'C1'))).toBe(2); // puin
    expect(pathCost(map, a, path('D1', 'E1'))).toBe(2); // water
    expect(pathCost(map, a, path('F1', 'G1'))).toBe(2); // ladder
  });

  it('in de stal: het hooi is moeilijk terrein', () => {
    const map = parseMapText(TEST_MAP).map!;
    const am = tok(map, 'Am');
    expect(pathCost(map, am, path('C2', 'B1', 'A1'))).toBe(4);
  });

  it('moeilijk terrein in de mist kost niets (verklapt niets)', () => {
    const map = load({
      terrain: [{ kind: 'difficult', cell: 'B1' }],
      regions: [{ id: 'r', cell: 'B1' }],
      tokens: [{ id: 'A', side: 'player', cell: 'A1' }],
    });
    expect(pathCost(map, tok(map, 'A'), path('A1', 'B1'))).toBe(1);
  });

  it('liggend = kruipen: elk vakje 1 extra, bovenop moeilijk terrein', () => {
    const map = load({
      terrain: [{ kind: 'difficult', cell: 'B1' }],
      tokens: [{ id: 'A', side: 'player', cell: 'A1', speed: 6, conditions: ['prone'] }],
    });
    expect(pathCost(map, tok(map, 'A'), path('A1', 'B1', 'C1'))).toBe(5);
  });

  it('2×2-token: moeilijk als één van zijn vakjes moeilijk is', () => {
    const map = load({
      terrain: [{ kind: 'difficult', cell: 'C2' }],
      tokens: [{ id: 'G', side: 'player', cell: 'A1', size: 2 }],
    });
    expect(pathCost(map, tok(map, 'G'), path('A1', 'B1'))).toBe(2);
  });
});

describe('condities (F14)', () => {
  it('Nederlandse namen; onbekend blijft zoals het is', () => {
    expect(conditionLabel('prone')).toBe('liggend');
    expect(conditionLabel('Grappled')).toBe('vastgegrepen');
    expect(conditionLabel('hexed')).toBe('hexed');
  });

  it('vastgegrepen = speed 0: elke stap is te veel', () => {
    const s = applyPatch(createState(parseMapText(TEST_MAP).map!), {
      type: 'patch', version: 1, map: 'Stal', tokens: { Ak: { conditions: ['grappled'] } },
    }).state;
    const ak = tok(s.map, 'Ak');
    expect(effectiveSpeed(ak)).toBe(0);
    expect(isOverSpeed(ak, 0)).toBe(false);
    expect(isOverSpeed(ak, 1)).toBe(true);
  });
});

describe('opportunity attack', () => {
  it('weggaan bij een vijand wordt gemeld, langs een vijand lopen niet', () => {
    const map = load({
      tokens: [{ id: 'A', side: 'player', cell: 'B2' }, { id: 'V', name: 'Vijand', side: 'enemy', cell: 'C2' }],
    });
    const a = tok(map, 'A');
    expect(leftReach(map, a, path('B2', 'A2'))).toEqual(['Vijand']);
    expect(leftReach(map, a, path('B2', 'B1', 'C1', 'D1'))).toEqual([]);
    expect(leftReach(map, a, path('B2', 'B3', 'B4'))).toEqual(['Vijand']);
  });
});

describe('licht (F13)', () => {
  it('donker in auto zodra er lichten zijn', () => {
    expect(isDark(load({}), 'auto')).toBe(false);
    expect(isDark(load({ lights: [{ cell: 'A1', radius: 2 }] }), 'auto')).toBe(true);
    expect(isDark(load({}), 'aan')).toBe(true);
    expect(isDark(load({ lights: [{ cell: 'A1', radius: 2 }] }), 'uit')).toBe(false);
  });

  it('props geven licht, tenzij de DM er al een licht op zette; niets uit de mist', () => {
    const map = load({
      props: [{ tile: 'brazier', cell: 'B2' }, { tile: 'candle', cell: 'E5' }, { tile: 'lantern', cell: 'H8' }],
      lights: [{ cell: 'E5', radius: 2, color: '#ff0000' }],
      regions: [{ id: 'r', area: 'G7:J10' }],
    });
    const src = lightSources(map);
    expect(src.map((s) => [s.x, s.y, s.radius, s.fromProp])).toEqual([[4.5, 4.5, 2, false], [1.5, 1.5, 2, true]]);
  });

  it('licht stopt aan een muur en een dichte deur, niet aan een raam of open deur', () => {
    const wall = { tile: 'stone', path: [[5, 0], [5, 10]] };
    const reachRight = (map: MapData) =>
      Math.max(...visibilityPolygon(3.5, 4.5, 4, lightBlockers(map)).map(([x]) => x));
    expect(reachRight(load({ walls: [wall] }))).toBeLessThanOrEqual(5.001);
    expect(reachRight(load({ walls: [wall], doors: [{ cell: 'E5', side: 'O', state: 'closed' }] }))).toBeLessThanOrEqual(5.001);
    expect(reachRight(load({ walls: [wall], doors: [{ cell: 'E5', side: 'O', tile: 'window' }] }))).toBeGreaterThan(6);
    expect(reachRight(load({ walls: [wall], doors: [{ cell: 'E5', side: 'O', state: 'open' }] }))).toBeGreaterThan(6);
  });

  it('zonder muren: een cirkel', () => {
    const pts = visibilityPolygon(5, 5, 3, []);
    for (const [x, y] of pts) expect(Math.hypot(x - 5, y - 5)).toBeCloseTo(3, 3);
  });
});
