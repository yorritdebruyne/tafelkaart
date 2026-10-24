import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify, compileMap, floorScoreOf, imageSize, indexPaths, pickSome, pruneIndex, relFromFa, sizeFromName } from './fa-match.js';

const map = JSON.parse(readFileSync(new URL('../src/tiles/fa-map.json', import.meta.url), 'utf8'));
const c = compileMap(map);

describe('FA-koppeling', () => {
  it('pad binnen de bibliotheek', () => {
    expect(relFromFa('Core_Mapmaking_Pack_Part1_v1.13\\FA_Assets\\!Core_Settlements\\Natural_Decor\\Hay\\Hay_Bale_01_A1_2x1.png'))
      .toBe('!Core_Settlements/Natural_Decor/Hay/Hay_Bale_01_A1_2x1.png');
  });

  it('grootte uit de naam', () => {
    expect(sizeFromName('Hay_Bale_01_A1_2x1.png')).toEqual({ w: 2, h: 1 });
    expect(sizeFromName('Cobblestone_A_01.jpg')).toBeNull();
  });

  it('props en vloeren worden herkend', () => {
    expect(classify(c, '!Core_Settlements/Natural_Decor/Hay/Hay_Bale_01_A1_2x1.png')).toEqual([{ kind: 'props', id: 'hay' }]);
    expect(classify(c, '!Core_Settlements/Workplace_Equipment/Farming/Husbandry/Troughs/Trough_Wood_Ashen_Empty_A_2x1.png'))
      .toEqual([{ kind: 'props', id: 'trough' }]);
    expect(classify(c, '!Core_Settlements/Textures/Stone_Floors/Cobblestone_A_01.jpg')).toEqual([{ kind: 'floor', id: 'cobble' }]);
    expect(classify(c, 'Woodlands/!Wilderness/Textures/Dirt/Dirt_A_01.jpg')).toEqual([{ kind: 'floor', id: 'dirt' }]);
  });

  it('niet: zonder grootte, Paths-mappen, uitgesloten namen', () => {
    expect(classify(c, '!Core_Settlements/Decor/Storage/Barrels/Barrel_Lid_Wood_Ashen_B1_Rusty_1x1.png')).toEqual([]);
    expect(classify(c, '!Core_Settlements/Natural_Decor/Hay/Paths/Hay_Path_A1.png')).toEqual([]);
    expect(classify(c, '!Core_Settlements/Natural_Decor/Hay/Hay_Bale_01_A1.png')).toEqual([]);
  });

  it('inhoudsgrenzen: paddenstoelen, schimmel en ratten nooit', () => {
    expect(classify(c, 'Woodlands/!Wilderness/Flora/Flowers_Mushroom_A1_1x1.png')).toEqual([]);
    expect(classify(c, '!Core_Settlements/Decor/Storage/Sacks/Sack_Rat_Chewed_A1_1x1.png')).toEqual([]);
    expect(classify(c, '!Core_Settlements/Decor/Storage/Sacks/Sack_Mold_A1_1x1.png')).toEqual([]);
    // "Crate" bevat "rat" maar is geen rat.
    expect(classify(c, '!Core_Settlements/Decor/Storage/Boxes_and_Crates/Crates/Crate_Wood_Ashen_A1_1x1.png'))
      .toEqual([{ kind: 'props', id: 'crate' }]);
  });

  it('afmetingen uit een PNG- en JPG-kop', () => {
    const png = Buffer.alloc(24);
    png.set([0x89, 0x50, 0x4e, 0x47], 0);
    png.writeUInt32BE(400, 16);
    png.writeUInt32BE(200, 20);
    expect(imageSize(png)).toEqual({ width: 400, height: 200 });
    // Minimale JPG: SOI, APP0 (lengte 4), SOF0 met hoogte 600 en breedte 1000.
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0xe8, 0, 0, 0, 0, 0]);
    expect(imageSize(jpg)).toEqual({ width: 1000, height: 600 });
  });

  it('slanker: hoogstens k per grootte, elke sfeer krijgt zijn varianten', () => {
    const themes = { standaard: { prefer: ['Ashen'], avoid: ['Broken'] }, verlaten: { prefer: ['Broken'], avoid: [] } };
    const barrels = Array.from({ length: 20 }, (_, i) => [`b/Barrel_${i % 4 === 0 ? 'Broken_' : ''}Wood_${i % 3 ? 'Dark' : 'Ashen'}_A${i}_1x1.png`, 1, 1]);
    const some = pickSome(barrels, (e) => e[0], themes, 6);
    expect(some).toHaveLength(6);
    expect(some.some((e) => /Broken/.test(e[0]))).toBe(true);
    expect(some.some((e) => /Ashen/.test(e[0]) && !/Broken/.test(e[0]))).toBe(true);
    expect(pickSome(barrels, (e) => e[0], themes, 6)).toEqual(some); // vast

    const index = {
      themes,
      props: { barrel: [...barrels, ['b/Barrel_Big_A_2x2.png', 2, 2]] },
      floor: { dirt: [['d/Dirt_A.jpg', 1000, 1000]] },
      walls: { wood: { strips: [['w/Wall_Path.png', 1650, 200, 0, 0, 1, 1]], connectors: [] } },
      doors: {},
      decor: { dirt: Array.from({ length: 40 }, (_, i) => `l/Leaf_${i}_1x1.png`) },
    };
    pruneIndex(index);
    expect(index.props.barrel).toHaveLength(7); // 6 van 1x1 + de enige 2x2
    expect(index.decor.dirt).toHaveLength(24);
    expect(indexPaths(index)).toHaveLength(7 + 1 + 1 + 24);
  });

  it('vloeren: per sfeer 3 uit de eigen familie bewaren', () => {
    const themes = {
      standaard: { prefer: [], avoid: [], floors: { dirt: '^Rocky_Dirt_' } },
      rijk: { prefer: [], avoid: [], floors: { dirt: '^Dirt_' } },
      verlaten: { prefer: [], avoid: [], floors: { dirt: '^Cracked_Dirt_' } },
    };
    const files = ['Dirt', 'Rocky_Dirt', 'Cracked_Dirt'].flatMap((f) =>
      Array.from({ length: 8 }, (_, i) => [`d/${f}_A_0${i}.jpg`, 1000, 1000]));
    const index = { themes, props: {}, floor: { dirt: files }, doors: {}, decor: {} };
    pruneIndex(index);
    const kept = index.floor.dirt.map((e) => e[0]);
    expect(kept).toHaveLength(9);
    expect(kept.filter((p) => p.startsWith('d/Dirt_'))).toHaveLength(3);
    expect(kept.filter((p) => p.startsWith('d/Rocky_'))).toHaveLength(3);
    expect(kept.filter((p) => p.startsWith('d/Cracked_'))).toHaveLength(3);
    expect(floorScoreOf('d/Cracked_Dirt_A_01.jpg', themes.verlaten, 'dirt')).toBe(100);
  });

  it('vloerregels in fa-map.json: families komen in de index', () => {
    const map = JSON.parse(readFileSync(new URL('../src/tiles/fa-map.json', import.meta.url), 'utf8'));
    const c = compileMap(map);
    const at = (dir, file) => classify(c, `${dir}/${file}`).map((h) => h.id);
    expect(at('Woodlands/!Wilderness/Textures/Dirt', 'Cracked_Dirt_A_01.jpg')).toEqual(['dirt']);
    expect(at('Woodlands/!Wilderness/Textures/Dirt', 'Grassy_Dirt_A_01.jpg')).toEqual([]);
    expect(at('Woodlands/!Wilderness/Textures/Grass', 'Patchy_Grass_A_01.jpg')).toEqual(['grass']);
    expect(at('!Core_Settlements/Textures/Stone_Floors', 'Cobblestone_Square_A_01.jpg')).toEqual(['cobble']);
    expect(at('!Core_Settlements/Textures/Stone_Floors', 'Rock_Tiles_A_Mossy_01.jpg')).toEqual(['stone']);
    expect(at('!Core_Settlements/Textures/Stone_Floors', 'Cobblestone_A_Dirt1.jpg')).toEqual([]);
  });
});
