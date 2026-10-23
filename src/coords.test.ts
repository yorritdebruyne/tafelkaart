import { describe, expect, it } from 'vitest';
import { chebyshev, colToLetters, formatCell, parseArea, parseCell } from './coords';

describe('coords', () => {
  it('E9 <-> { c: 4, r: 8 }', () => {
    expect(parseCell('E9')).toEqual({ c: 4, r: 8 });
    expect(formatCell({ c: 4, r: 8 })).toBe('E9');
  });

  it('kleine letters en spaties mogen', () => {
    expect(parseCell(' e9 ')).toEqual({ c: 4, r: 8 });
  });

  it('na Z komt AA (voor kaarten breder dan 26)', () => {
    expect(colToLetters(25)).toBe('Z');
    expect(colToLetters(26)).toBe('AA');
    expect(parseCell('AD30')).toEqual({ c: 29, r: 29 });
  });

  it('ongeldige vakjes geven null', () => {
    expect(parseCell('9E')).toBeNull();
    expect(parseCell('E0')).toBeNull();
    expect(parseCell('')).toBeNull();
  });

  it('area: hoeken inbegrepen, in elke volgorde', () => {
    expect(parseArea('A1:J8')).toEqual({ c1: 0, r1: 0, c2: 9, r2: 7 });
    expect(parseArea('J8:A1')).toEqual({ c1: 0, r1: 0, c2: 9, r2: 7 });
    expect(parseArea('A2:A2')).toEqual({ c1: 0, r1: 1, c2: 0, r2: 1 });
    expect(parseArea('A1:B2:C3')).toBeNull();
  });

  it('diagonaal telt als 1 vakje', () => {
    expect(chebyshev({ c: 0, r: 0 }, { c: 3, r: 3 })).toBe(3);
    expect(chebyshev({ c: 0, r: 0 }, { c: 3, r: 1 })).toBe(3);
  });
});
