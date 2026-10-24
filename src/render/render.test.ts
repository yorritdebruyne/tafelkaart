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
    expect(view.layers.fog.querySelectorAll('g.fog[data-region="zadelkamer"]')).toHaveLength(1);
    expect(view.layers.fog.querySelectorAll('[data-door="zadel"]')).toHaveLength(1); // deur op de rand blijft zichtbaar
    expect(view.layers.players.querySelectorAll('[data-token]')).toHaveLength(2);
    expect(view.tokenEls.has('T5')).toBe(false); // verborgen vijand: niet getekend

    state = applyPatch(state, JSON.parse(TEST_PATCH)).state;
    renderMap(view, state, null);
    expect(view.layers.fog.querySelectorAll('g.fog')).toHaveLength(0);
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
    // 2×1 op 1 vakje: echte grootte, vanaf het vakje naar rechts (C3:D3).
    expect(['x', 'y', 'width', 'height'].map((a) => imgs[2].getAttribute(a))).toEqual(['-32', '-32', '128', '64']);
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

  it('muren met FA-strook: rechthoek per stuk muur, hoekstuk op elk punt', () => {
    setFaIndex({
      pxPerCell: 200, themes: { standaard: { prefer: [], avoid: [] } }, props: {}, floor: {},
      walls: {
        wood: {
          strips: [['W/Wall_Wood_Ashen_A_Straight_Path.png', 1650, 200, 0, 0.39, 1, 0.61]],
          connectors: [['W/Wall_Wood_Ashen_A_Connector_A_1x1.png', 200, 200, 0.23, 0.39, 0.78, 0.61]],
        },
      },
    });
    const res = parseMapObject({
      type: 'map', version: 1, name: 'X', cols: 4, rows: 4,
      walls: [{ tile: 'wood', path: [[0, 0], [4, 0], [4, 4]] }, { tile: 'palisade', path: [[0, 2], [2, 2]] }],
    });
    const view = createMapView();
    renderMap(view, createState(res.map!), null);
    const wall = view.layers.walls.querySelector('.wall-textured')!;
    expect(wall.querySelectorAll('rect')).toHaveLength(2);
    expect(wall.querySelectorAll('image.wall-connector')).toHaveLength(3);
    expect(wall.querySelectorAll('g')[1].getAttribute('transform')).toBe('translate(256 0) rotate(90)');
    const pattern = view.layers.walls.querySelector('pattern')!;
    expect([pattern.getAttribute('width'), pattern.getAttribute('y')]).toEqual(['528', '-32']); // 1650 px = 8,25 vakjes
    // Palissade heeft geen FA-strook: gewone lijn.
    expect(view.layers.walls.querySelectorAll('polyline')).toHaveLength(1);
  });

  it('FA-deur: kozijn + blad op de rand; open deur draait naar het vakje', () => {
    setFaIndex({
      pxPerCell: 200, themes: { standaard: { prefer: [], avoid: [] } }, props: {}, floor: {},
      doors: { 'door-wood': { doors: [['D/Door_Wood_A_1x1.png', 1, 1]], frames: [['D/Door_Frame_Wood_A_3x1.png', 3, 1]] } },
    });
    const res = parseMapObject({
      type: 'map', version: 1, name: 'X', cols: 4, rows: 4,
      doors: [
        { id: 'a', cell: 'B2', side: 'Z', state: 'closed' },
        { id: 'b', cell: 'B2', side: 'W', state: 'open' },
        { id: 'c', cell: 'C3', side: 'N', state: 'open' },
      ],
    });
    const view = createMapView();
    renderMap(view, createState(res.map!), null);
    const doors = [...view.layers.walls.querySelectorAll<SVGGElement>('.door-fa')];
    expect(doors.map((d) => d.getAttribute('transform'))).toEqual([
      'translate(96 128) rotate(0)', 'translate(64 96) rotate(90)', 'translate(160 128) rotate(0)',
    ]);
    expect(doors[0].querySelector('.door-frame')?.getAttribute('width')).toBe('192');
    // Gesloten: blad niet gedraaid. Open naar het vakje: W-kant -> -90, N-kant -> +90.
    const leafRot = (d: SVGGElement) => d.querySelector('image.door-leaf-img')!.parentElement!.getAttribute('transform');
    expect(leafRot(doors[0])).toBeNull();
    expect(leafRot(doors[1])).toBe('rotate(-90 -32 0)');
    expect(leafRot(doors[2])).toBe('rotate(90 -32 0)');
  });

  it('versiering: vast per vakje, niet op props, hoeveelheid volgens de sfeer', () => {
    const index = {
      pxPerCell: 200, props: {}, floor: {},
      themes: { standaard: { prefer: [], avoid: [], decor: 0.5 }, leeg: { prefer: [], avoid: [], decor: 0 } },
      decor: { dirt: ['L/Fallen_Leaf_A1_1x1.png', 'L/Twig_A1_1x1.png'] },
    };
    setFaIndex(index);
    const map = parseMapObject({
      type: 'map', version: 1, name: 'X', cols: 10, rows: 10,
      floor: [{ tile: 'dirt', area: 'A1:J10' }], props: [{ tile: 'hay', area: 'A1:J2' }],
    }).map!;
    const count = () => {
      const view = createMapView();
      renderMap(view, createState(map), null);
      return [...view.layers.decor.querySelectorAll('image')];
    };
    const first = count();
    expect(first.length).toBeGreaterThan(20); // ±50 % van 80 vrije vakjes
    expect(first.length).toBeLessThan(60);
    expect(count().map((i) => i.getAttribute('transform'))).toEqual(first.map((i) => i.getAttribute('transform')));
    // Niets in rij 1-2 (daar ligt hooi).
    expect(first.every((i) => Number(/translate\([\d.]+ ([\d.]+)\)/.exec(i.getAttribute('transform')!)![1]) > 128)).toBe(true);
    setSfeer('leeg');
    expect(count()).toHaveLength(0);
  });
});
