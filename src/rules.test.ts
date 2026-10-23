import { describe, expect, it } from 'vitest';
import { parseCell } from './coords';
import { extendPath, pathLength, positionsText, squaresToMeters } from './rules';
import type { TokenItem } from './schema';

const c = (s: string) => parseCell(s)!;

describe('rules', () => {
  it('weg tellen: recht, diagonaal en sprongen', () => {
    expect(pathLength([c('E9')])).toBe(0);
    expect(pathLength([c('E9'), c('E8'), c('F7')])).toBe(2);
    expect(pathLength([c('A1'), c('D4')])).toBe(3);
  });

  it('terugslepen kort de weg in', () => {
    let path = [c('E9')];
    path = extendPath(path, c('E8'));
    path = extendPath(path, c('E7'));
    path = extendPath(path, c('E8'));
    expect(path).toEqual([c('E9'), c('E8')]);
    path = extendPath(path, c('E9'));
    expect(pathLength(path)).toBe(0);
  });

  it('rond een hoek lopen telt alle stappen', () => {
    const path = [c('A1'), c('B1'), c('C1'), c('C2'), c('C3')];
    expect(pathLength(path)).toBe(4);
  });

  it('meters met een komma', () => {
    expect(squaresToMeters(3)).toBe('4,5 m');
    expect(squaresToMeters(4)).toBe('6 m');
  });

  it('posities: spelers eerst', () => {
    const tokens: TokenItem[] = [
      { id: 'T3', name: 'T3', side: 'enemy', cell: c('E8'), size: 1 },
      { id: 'Ak', name: 'Akmenos', side: 'player', cell: c('E9'), size: 1, speed: 6 },
      { id: 'Am', name: 'Amara', side: 'player', cell: c('E7'), size: 1, speed: 7 },
    ];
    expect(positionsText(tokens)).toBe('Posities: Akmenos: E9, Amara: E7, T3: E8');
  });
});
