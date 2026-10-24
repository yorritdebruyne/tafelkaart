// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { parseMapObject, parseMapText } from '../schema';
import { applyPatch } from '../patch';
import { createState } from '../state';
import { setFaIndex, setSfeer } from '../tiles';
import { TEST_MAP, TEST_PATCH } from '../testmap';
import { createMapView, renderMap } from './index';

describe('render', () => {
  // Tests mogen niet afhangen van de FA-bibliotheek op de pc.
  beforeEach(() => {
    setFaIndex(undefined);
    setSfeer('standaard');
  });

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
    expect(view.layers.fog.querySelectorAll('[data-door="zadel"]')).toHaveLength(1); // deur op de rand blijft zichtbaar
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

  it('props: placeholder met naam, afbeelding als die bestaat, rotatie rond het midden', () => {
    const res = parseMapObject({
      type: 'map', version: 1, name: 'X', cols: 4, rows: 4,
      props: [
        { tile: 'hay', area: 'A1:B1' },
        { tile: '_voorbeeld', cell: 'C3', rot: 90 },
        { tile: 'bed', area: 'A3:A4', rot: -90 },
        { tile: 'zetel', cell: 'D1' },
      ],
    });
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual(['props[3]: onbekende tegel "zetel", wordt grijs getekend.']);
    expect(res.map!.props[2].rot).toBe(270);

    const view = createMapView();
    renderMap(view, createState(res.map!), null);
    const props = [...view.layers.props.querySelectorAll<SVGGElement>('[data-prop]')];
    expect(props.map((p) => p.dataset.prop)).toEqual(['hay', '_voorbeeld', 'bed', 'zetel']);
    // hay: placeholder, 2×1 vakjes, midden op (64, 32)
    expect(props[0].getAttribute('transform')).toBe('translate(64 32) rotate(0)');
    expect(props[0].querySelector('text')?.textContent).toBe('hay');
    // _voorbeeld: er staat een voorbeeld-afbeelding in src/tiles/props/
    expect(props[1].querySelector('image')?.getAttribute('href')).toBeTruthy();
    expect(props[1].querySelector('image')?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    // bed van 1×2 vakjes, kwartslag gedraaid: getekend als 2×1 vóór het draaien
    const bedRect = props[2].querySelector('rect.prop-placeholder')!;
    expect(Number(bedRect.getAttribute('width'))).toBeGreaterThan(Number(bedRect.getAttribute('height')));
    expect(props[3].querySelector('rect.unknown')).not.toBeNull();
  });

  it('Forgotten Adventures: passende variant op echte grootte, vloertextuur op echte grootte', () => {
    setFaIndex({
      pxPerCell: 200,
      themes: { standaard: { prefer: [], avoid: [] } },
      props: {
        hay: [['Hay/Hay_Bale_01_A1_2x1.png', 2, 1], ['Hay/Hay_Bale_A_01_1x1.png', 1, 1]],
        trough: [['Troughs/Trough_A_2x1.png', 2, 1]],
      },
      floor: { dirt: [['Dirt/Dirt_A_01.jpg', 1000, 1000]] },
    });
    const res = parseMapObject({
      type: 'map', version: 1, name: 'X', cols: 4, rows: 4,
      floor: [{ tile: 'dirt', area: 'A1:D4' }],
      props: [{ tile: 'hay', area: 'A1:B1' }, { tile: 'hay', cell: 'A2' }, { tile: 'trough', cell: 'C3' }],
    });
    expect(res.warnings).toEqual([]);
    const view = createMapView();
    renderMap(view, createState(res.map!), null);
    const imgs = [...view.layers.props.querySelectorAll('image')];
    expect(imgs.map((i) => i.getAttribute('href'))).toEqual([
      'fa/Hay/Hay_Bale_01_A1_2x1.png', 'fa/Hay/Hay_Bale_A_01_1x1.png', 'fa/Troughs/Trough_A_2x1.png',
    ]);
    expect([imgs[0].getAttribute('width'), imgs[0].getAttribute('height')]).toEqual(['128', '64']);
    expect([imgs[2].getAttribute('width'), imgs[2].getAttribute('height')]).toEqual(['64', '32']); // 2×1 in 1 vakje: ingeschaald
    const pattern = view.layers.floor.querySelector('pattern')!;
    expect(pattern.getAttribute('width')).toBe('320'); // 1000 px = 5 vakjes
    expect(pattern.querySelector('image')?.getAttribute('href')).toBe('fa/Dirt/Dirt_A_01.jpg');
  });

  it('muur-prop: ladder draait naar de muur en ligt ertegen', () => {
    setFaIndex({
      pxPerCell: 200,
      themes: { standaard: { prefer: [], avoid: [] } },
      wall: { ladder: { prefer: 'Wall' } },
      props: { ladder: [['L/Ladder_Wood_Ashen_Wall_A1_1x1.png', 1, 1, 0.1, 0.43, 0.9, 0.58]] },
      floor: {},
    });
    const res = parseMapObject({
      type: 'map', version: 1, name: 'X', cols: 4, rows: 4,
      walls: [{ path: [[0, 0], [4, 0], [4, 4]] }],
      props: [{ tile: 'ladder', cell: 'B1' }, { tile: 'ladder', cell: 'D3' }, { tile: 'ladder', cell: 'B3' }, { tile: 'ladder', cell: 'D1', rot: 180 }],
    });
    const view = createMapView();
    renderMap(view, createState(res.map!), null);
    const props = [...view.layers.props.querySelectorAll('[data-prop]')];
    const rot = (i: number) => /rotate\((\d+)\)/.exec(props[i].getAttribute('transform')!)![1];
    expect([rot(0), rot(1), rot(2), rot(3)]).toEqual(['0', '90', '0', '180']); // noordmuur, oostmuur, geen muur, DM-rot blijft
    // Tegen de noordmuur: bovenkant van de tekening (43 % van 64) ligt op -32 + 5,12.
    const img = props[0].querySelector('image')!;
    expect(Number(img.getAttribute('y')) + 0.43 * 64).toBeCloseTo(-32 + 64 * 0.08, 5);
    // Zonder muur: gewoon in het midden.
    expect(props[2].querySelector('image')!.getAttribute('y')).toBe('-32');
  });
});
