import { describe, expect, it } from 'vitest';
import { buildIndex } from './index';

describe('tegel-lader', () => {
  it('privémap wint van de gewone map; PNG wint van SVG', () => {
    const idx = buildIndex({
      './props/barrel.svg': 'gewoon.svg',
      './prive/props/barrel.png': 'prive.png',
      './props/crate.svg': 'crate.svg',
      './props/crate.png': 'crate.png',
      './floor/dirt.png': 'dirt.png',
      './prive/floor/Barrel_Wood_A1.png': 'fa.png',
      './andere/map.png': 'genegeerd',
    });
    expect(idx.props).toEqual({ barrel: 'prive.png', crate: 'crate.png' });
    expect(idx.floor).toEqual({ dirt: 'dirt.png', Barrel_Wood_A1: 'fa.png' });
  });

  it('volgorde van de bestanden maakt niet uit', () => {
    const idx = buildIndex({ './prive/props/barrel.png': 'prive.png', './props/barrel.png': 'gewoon.png' });
    expect(idx.props.barrel).toBe('prive.png');
  });
});
