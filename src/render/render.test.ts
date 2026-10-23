// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMapObject, parseMapText } from '../schema';
import { applyPatch } from '../patch';
import { createState } from '../state';
import { TEST_MAP, TEST_PATCH } from '../testmap';
import { createMapView, renderMap } from './index';

describe('render', () => {
  it('tekent de stal: 5 tokens, 6 muren, 1 deur', () => {
    const view = createMapView();
    renderMap(view, createState(parseMapText(TEST_MAP).map!), null);
    expect(view.svg.querySelectorAll('[data-token]')).toHaveLength(5);
    expect(view.layers.walls.querySelectorAll('polyline')).toHaveLength(6);
    expect(view.layers.walls.querySelectorAll('[data-door]')).toHaveLength(1);
    expect(view.tokenEls.get('Ak')?.getAttribute('transform')).toBe('translate(256 512)');
  });

  it('mist over de zadelkamer; spelers boven de mist; na de patch is de mist weg', () => {
    const view = createMapView();
    let state = createState(parseMapText(TEST_MAP).map!);
    state = applyPatch(state, { type: 'patch', version: 1, map: 'Stal', tokens: { T5: { add: { side: 'enemy', cell: 'I7' } } } }).state;
    renderMap(view, state, null);
    expect(view.layers.fog.querySelectorAll('rect.fog')).toHaveLength(1);
    expect(view.layers.players.querySelectorAll('[data-token]')).toHaveLength(2);
    expect(view.tokenEls.has('T5')).toBe(false); // verborgen vijand: niet getekend

    state = applyPatch(state, JSON.parse(TEST_PATCH)).state;
    renderMap(view, state, null);
    expect(view.layers.fog.querySelectorAll('rect.fog')).toHaveLength(0);
    expect(view.tokenEls.has('T5')).toBe(true);
    expect(view.tokenEls.has('T2')).toBe(false);
    expect(view.layers.walls.querySelector('[data-door="zadel"]')?.classList.contains('door-open')).toBe(true);
  });

  it('onbekende tegel: grijs vakje met de naam (F18)', () => {
    const res = parseMapObject({
      type: 'map', version: 1, name: 'X', cols: 3, rows: 3,
      floor: [{ tile: 'marmer', area: 'A1:B1' }],
    });
    const view = createMapView();
    renderMap(view, createState(res.map!), null);
    const labels = [...view.layers.floor.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toEqual(['marmer', 'marmer']);
  });
});
