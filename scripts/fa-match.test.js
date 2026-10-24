import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify, compileMap, imageSize, relFromFa, sizeFromName } from './fa-match.js';

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
});
