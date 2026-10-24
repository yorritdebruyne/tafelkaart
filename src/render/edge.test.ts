import { describe, expect, it } from 'vitest';
import { noise1, onWalls, raggedRect } from './edge';

const points = (d: string) => d.slice(1, -1).split('L').map((p) => p.split(',').map(Number));

describe('golvende rand', () => {
  it('ruis ligt tussen 0 en 1 en is vast per zaad', () => {
    for (let t = 0; t < 10; t += 0.37) {
      const n = noise1('a', t);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(noise1('a', t)).toBe(n);
    }
  });

  it('de rand ligt altijd tussen de rechthoek en "spill" erbuiten', () => {
    const d = raggedRect(0, 0, 640, 320, 20, 80, 10, 'x');
    for (const [x, y] of points(d)) {
      const outside = Math.max(-x, x - 640, -y, y - 320);
      expect(outside).toBeGreaterThanOrEqual(-0.01);
      expect(outside).toBeLessThanOrEqual(20.01);
    }
    expect(raggedRect(0, 0, 640, 320, 20, 80, 10, 'x')).toBe(d);
  });

  it('waar een muur staat, blijft de rand recht', () => {
    const walled = onWalls([[0, 0, 640, 0]]); // muur langs de bovenkant
    const top = points(raggedRect(0, 0, 640, 320, 20, 80, 10, 'x', walled)).filter(([, y]) => y <= 0);
    expect(top.length).toBeGreaterThan(10);
    for (const [, y] of top) expect(y).toBe(0);
  });
});
