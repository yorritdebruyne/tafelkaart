import { describe, expect, it } from 'vitest';
import { isTokenHidden, visibleTokens } from './fog';
import { applyPatch, patchFingerprint } from './patch';
import { positionsText } from './rules';
import { parseMapText } from './schema';
import { createState, getPath, moveToken } from './state';
import { TEST_MAP, TEST_PATCH } from './testmap';

const stal = () => createState(parseMapText(TEST_MAP).map!);
const patch = (extra: object) => ({ type: 'patch', version: 1, map: 'Stal', ...extra });

describe('patch', () => {
  it('de testpatch werkt op de stal', () => {
    const before = stal();
    const res = applyPatch(before, JSON.parse(TEST_PATCH));
    expect(res.errors).toEqual([]);
    expect(res.applied).toBe(true);
    const { map } = res.state;
    expect(map.tokens.map((t) => t.id)).toEqual(['Ak', 'Am', 'P', 'T1', 'T3']);
    expect(map.tokens.find((t) => t.id === 'T1')?.cell).toEqual({ c: 2, r: 2 });
    expect(map.tokens.find((t) => t.id === 'T3')).toMatchObject({ side: 'enemy', cell: { c: 6, r: 6 }, size: 1 });
    expect(map.tokens.find((t) => t.id === 'Ak')?.conditions).toEqual(['prone']);
    expect(map.doors[0].state).toBe('open');
    expect(map.regions[0].hidden).toBe(false);
    expect(res.changes).toEqual([
      'T1 → C3', 'T2 weg', 'T3 erbij op G7', 'Akmenos: liggend', 'deur zadel open', 'zadelkamer zichtbaar',
    ]);
    // De oude state is niet veranderd (belangrijk voor undo in M3).
    expect(before.map.tokens).toHaveLength(5);
    expect(before.map.doors[0].state).toBe('closed');
  });

  it('patch voor een andere kaart wordt geweigerd', () => {
    const res = applyPatch(stal(), { ...patch({}), map: 'Grot' });
    expect(res.applied).toBe(false);
    expect(res.errors[0]).toContain('"Grot"');
  });

  it('kaartnaam: hoofdletters en spaties maken niet uit', () => {
    expect(applyPatch(stal(), { ...patch({}), map: ' stal ' }).applied).toBe(true);
  });

  it('dezelfde patch twee keer: de tweede keer gebeurt er niets', () => {
    const once = applyPatch(stal(), JSON.parse(TEST_PATCH)).state;
    // Andere spaties en volgorde: toch dezelfde patch.
    const again = applyPatch(once, { reveal: ['zadelkamer'], ...JSON.parse(TEST_PATCH) });
    expect(again.duplicate).toBe(true);
    expect(again.state).toBe(once);
  });

  it('fouten per item, de rest wordt toegepast', () => {
    const res = applyPatch(stal(), patch({
      tokens: {
        T9: { cell: 'A1' },
        T1: { cell: 'hier' },
        T2: { cell: 'K1' },
        Ak: { add: { side: 'player', cell: 'A1' } },
        T4: { add: { side: 'draak', cell: 'A1' } },
        P: { cell: 'J1' },
      },
      doors: { d1: { state: 'open' }, zadel: { state: 'kapot' } },
      reveal: ['nergens', 3],
    }));
    expect(res.errors).toEqual([
      'tokens.T9: onbekend token "T9" (gebruik "add" voor een nieuw token)',
      'tokens.T1.cell: onbekend vakje "hier"',
      'tokens.T2.cell: "K1" ligt buiten de kaart (10×10)',
      'tokens.Ak.add: token "Ak" bestaat al',
      'tokens.T4.add.side: moet "player" of "enemy" of "npc" zijn',
      'doors.d1: onbekende deur "d1"',
      'doors.zadel.state: moet "open" of "closed" of "locked" zijn',
      'reveal[0]: onbekende regio "nergens"',
      'reveal[1]: verwacht tekst (de id van een regio)',
    ]);
    expect(res.changes).toEqual(['Paard → J1']);
  });

  it('DM verplaatst een speler: de teller van die beurt begint opnieuw', () => {
    let s = stal();
    s = moveToken(s, 'Ak', [{ c: 4, r: 8 }, { c: 4, r: 7 }, { c: 4, r: 6 }]);
    s = applyPatch(s, patch({ tokens: { Ak: { cell: 'A9' } } })).state;
    expect(getPath(s, 'Ak')).toEqual([{ c: 0, r: 8 }]);
    expect(s.patches).toHaveLength(1);
  });

  it('kapotte kop: geen patch', () => {
    const res = applyPatch(stal(), { type: 'patch', version: 1 });
    expect(res.applied).toBe(false);
    expect(res.errors).toEqual(['map: ontbreekt']);
  });

  it('vingerafdruk hangt niet af van de volgorde van sleutels', () => {
    expect(patchFingerprint({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(patchFingerprint({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(patchFingerprint({ a: 1 })).not.toBe(patchFingerprint({ a: 2 }));
  });
});

describe('fog of war', () => {
  const withHiddenEnemy = () =>
    applyPatch(stal(), patch({ tokens: { T5: { add: { side: 'enemy', cell: 'I7' } } } })).state;

  it('vijand in een verborgen regio is verborgen, spelers nooit', () => {
    const s = withHiddenEnemy();
    const t5 = s.map.tokens.find((t) => t.id === 'T5')!;
    expect(isTokenHidden(s.map, t5)).toBe(true);
    const ak = { ...s.map.tokens[0], cell: { c: 8, r: 6 } };
    expect(isTokenHidden(s.map, ak)).toBe(false);
  });

  it('verborgen tokens komen niet in "Kopieer posities"', () => {
    const s = withHiddenEnemy();
    expect(positionsText(visibleTokens(s.map))).not.toContain('T5');
    const shown = applyPatch(s, patch({ reveal: ['zadelkamer'] })).state;
    expect(positionsText(visibleTokens(shown.map))).toContain('T5: I7');
  });

  it('2×2-token half in de mist blijft zichtbaar', () => {
    const s = applyPatch(stal(), patch({ tokens: { O: { add: { side: 'enemy', cell: 'G6', size: 2 } } } })).state;
    expect(isTokenHidden(s.map, s.map.tokens.find((t) => t.id === 'O')!)).toBe(false);
  });
});
