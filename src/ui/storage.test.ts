import { describe, expect, it } from 'vitest';
import { applyPatch } from '../patch';
import { parseMapText } from '../schema';
import { createState, moveToken } from '../state';
import { TEST_MAP, TEST_PATCH } from '../testmap';
import { SAVE_FORMAT, upgradeSaved } from './storage';

describe('bewaarde kaart van een oudere versie', () => {
  it('M1-kaart (zonder props en regions) wordt opnieuw ingelezen, posities blijven', () => {
    // Zo zag de bewaarde stal er in M1 uit: geen props, geen regions, geen patches.
    const m2 = moveToken(createState(parseMapText(TEST_MAP).map!), 'Ak', [{ c: 4, r: 8 }, { c: 4, r: 7 }]);
    const { props: _p, regions: _r, ...m1map } = m2.map;
    const m1 = { source: TEST_MAP, state: { map: m1map, paths: m2.paths } } as never;

    const up = upgradeSaved(m1)!;
    expect(up.format).toBe(SAVE_FORMAT);
    expect(up.state.map.regions).toHaveLength(1);
    expect(up.state.map.props).toHaveLength(5);
    expect(up.state.map.tokens.find((t) => t.id === 'Ak')?.cell).toEqual({ c: 4, r: 7 });
    expect(up.state.paths.Ak).toHaveLength(2);
    // En nu werkt de testpatch zonder fouten.
    expect(applyPatch(up.state, JSON.parse(TEST_PATCH)).errors).toEqual([]);
  });

  it('huidige versie: niets veranderd', () => {
    const saved = { source: TEST_MAP, state: createState(parseMapText(TEST_MAP).map!), format: SAVE_FORMAT };
    expect(upgradeSaved(saved)).toBe(saved);
  });
});
