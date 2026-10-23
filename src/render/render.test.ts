// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMapObject, parseMapText } from '../schema';
import { createState } from '../state';
import { TEST_MAP } from '../testmap';
import { createMapView, renderMap } from './index';

describe('render', () => {
  it('tekent de stal: 5 tokens, 6 muren, 1 deur', () => {
    const view = createMapView();
    renderMap(view, createState(parseMapText(TEST_MAP).map!), null);
    expect(view.layers.tokens.querySelectorAll('[data-token]')).toHaveLength(5);
    expect(view.layers.walls.querySelectorAll('polyline')).toHaveLength(6);
    expect(view.layers.walls.querySelectorAll('[data-door]')).toHaveLength(1);
    expect(view.tokenEls.get('Ak')?.getAttribute('transform')).toBe('translate(256 512)');
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
