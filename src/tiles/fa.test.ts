import { describe, expect, it } from 'vitest';
import { hash, pickFloor, pickProp, themeScore } from './fa';

const standaard = { prefer: ['Ashen'], avoid: ['Broken'] };
const verlaten = { prefer: ['Broken'], avoid: ['Fancy'] };

const HAY: [string, number, number][] = [
  ['h/Hay_Bale_01_A1_2x1.png', 2, 1],
  ['h/Hay_Bale_01_A2_2x1.png', 2, 1],
  ['h/Hay_Bale_01_A7_2x2.png', 2, 2],
  ['h/Hay_Bale_01_B1_1x1.png', 1, 1],
];

describe('variant kiezen (FA)', () => {
  it('2×1 vakjes: een 2×1-hooibaal, niet de 2×2', () => {
    const p = pickProp(HAY, 2, 1, 'hay|0,0')!;
    expect([p.w, p.h, p.turn, p.scale]).toEqual([2, 1, false, 1]);
    expect(p.path).toMatch(/_2x1\.png$/);
  });

  it('1×2 vakjes: de 2×1-baal draait een kwartslag', () => {
    const p = pickProp(HAY, 1, 2, 'x')!;
    expect([p.w, p.h, p.turn]).toEqual([1, 2, true]);
  });

  it('1×1 vakje: de 1×1-baal', () => {
    expect(pickProp(HAY, 1, 1, 'x')!.path).toMatch(/_1x1\.png$/);
  });

  it('niets past: de kleinste, op echte grootte (overflow)', () => {
    const p = pickProp([['t/Trough_A_2x1.png', 2, 1], ['t/Trough_B_3x2.png', 3, 2]], 1, 1, 'x')!;
    expect([p.w, p.h, p.scale, p.overflow]).toEqual([2, 1, 1, true]);
  });

  it('zelfde plek = zelfde keuze; andere plekken = variatie', () => {
    expect(pickProp(HAY, 2, 1, 'hay|0,0')).toEqual(pickProp(HAY, 2, 1, 'hay|0,0'));
    const paths = new Set(Array.from({ length: 20 }, (_, i) => pickProp(HAY, 2, 1, `hay|${i},0`)!.path));
    expect(paths.size).toBe(2);
  });

  it('sfeer: woorden in de naam', () => {
    const barrels: [string, number, number][] = [
      ['b/Barrel_Wood_Ashen_A1_1x1.png', 1, 1],
      ['b/Barrel_Broken_Wood_Ashen_A1_1x1.png', 1, 1],
      ['b/Barrel_Wood_Dark_A1_1x1.png', 1, 1],
    ];
    expect(themeScore(barrels[1][0], standaard)).toBe(-9);
    expect(pickProp(barrels, 1, 1, 'x', { theme: standaard })!.path).toBe(barrels[0][0]);
    expect(pickProp(barrels, 1, 1, 'x', { theme: verlaten })!.path).toBe(barrels[1][0]);
  });

  it('muur-props: liefst het woord "Wall", niet draaien, kader mee', () => {
    const ladders: [string, number, number, ...number[]][] = [
      ['l/Ladder_Wood_Ashen_Fallen_A1_2x1.png', 2, 1],
      ['l/Ladder_Wood_Ashen_Wall_A1_1x1.png', 1, 1, 0.1, 0.43, 0.9, 0.58],
    ];
    const p = pickProp(ladders, 1, 1, 'x', { prefer: 'Wall', noTurn: true })!;
    expect(p.path).toMatch(/_Wall_/);
    expect(p.box).toEqual([0.1, 0.43, 0.9, 0.58]);
    expect(pickProp([['l/Shelf_2x1.png', 2, 1]], 1, 2, 'x', { noTurn: true })!.turn).toBe(false);
  });

  it('geen kandidaten: niets', () => {
    expect(pickProp(undefined, 1, 1, 'x')).toBeUndefined();
    expect(pickFloor([], 'x')).toBeUndefined();
  });

  it('vloer: vaste keuze per zaad', () => {
    const dirt: [string, number, number][] = [['d/Dirt_A_01.jpg', 1200, 1200], ['d/Dirt_B_01.jpg', 600, 600]];
    expect(pickFloor(dirt, 'Stal|dirt')).toEqual(pickFloor(dirt, 'Stal|dirt'));
    expect(hash('a')).not.toBe(hash('b'));
    // x en y van hetzelfde punt mogen niet samenhangen (anders liggen dingen op een lijn).
    const xs = Array.from({ length: 200 }, (_, i) => hash(`p|${i}|x`) / 0xffffffff);
    const ys = Array.from({ length: 200 }, (_, i) => hash(`p|${i}|y`) / 0xffffffff);
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const mx = mean(xs), my = mean(ys);
    const cov = mean(xs.map((x, i) => (x - mx) * (ys[i] - my)));
    const corr = cov / Math.sqrt(mean(xs.map((x) => (x - mx) ** 2)) * mean(ys.map((y) => (y - my) ** 2)));
    expect(Math.abs(corr)).toBeLessThan(0.2);
  });
});
