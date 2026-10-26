// Welke vakjes kosten extra beweging (F12)?
//
// In 5e (2024) kost een vakje 1 extra als:
//   - het moeilijk terrein is: `terrain` van de DM, puin of struiken (props),
//     ondiep of diep water (waden of zwemmen);
//   - je klimt: een ladder;
//   - er een ander wezen staat (je mag door een bondgenoot, dat is moeilijk terrein);
//   - je kruipt (conditie "prone").
// Die extra's tellen op (kruipen door moeilijk terrein = 3 per vakje), behalve
// moeilijk terrein met zichzelf: twee keer moeilijk is nog altijd +1.
//
// Vakjes in de mist kosten nooit extra: anders verklapt de teller wat er ligt.
//
// Het resultaat hangt alleen van de kaart af, dus we onthouden het per kaart-object
// (de kaart is onveranderlijk: een nieuwe kaart = een nieuw object = opnieuw rekenen).

import { isCellHidden } from './fog';
import { buildBlockers, cellKey } from './movement';
import { layoutCells, propLayout } from './props-layout';
import type { MapData } from './schema';
import { CLIMB_PROPS, DIFFICULT_FLOORS, DIFFICULT_PROPS } from './tiles/palette';

export interface TerrainInfo {
  /** Moeilijk terrein (zichtbare vakjes). */
  difficult: Set<string>;
  /** Klimmen (ladder). */
  climb: Set<string>;
}

let cache = new WeakMap<MapData, TerrainInfo>();

/** Na een andere sfeer kunnen props een andere grootte hebben: opnieuw rekenen. */
export function clearTerrainCache(): void {
  cache = new WeakMap();
}

export function terrainInfo(map: MapData): TerrainInfo {
  const hit = cache.get(map);
  if (hit) return hit;
  const difficult = new Set<string>();
  const climb = new Set<string>();
  const add = (set: Set<string>, c: number, r: number) => {
    if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return;
    if (!isCellHidden(map, { c, r })) set.add(cellKey(c, r));
  };

  for (const t of map.terrain) {
    for (let r = t.rect.r1; r <= t.rect.r2; r++) for (let c = t.rect.c1; c <= t.rect.c2; c++) add(difficult, c, r);
  }

  // Bovenste vloer per vakje (later in de lijst = bovenop).
  const top = new Map<string, string>();
  for (const f of map.floor) {
    for (let r = f.rect.r1; r <= f.rect.r2; r++) for (let c = f.rect.c1; c <= f.rect.c2; c++) top.set(cellKey(c, r), f.tile);
  }
  for (const [key, tile] of top) {
    if (!DIFFICULT_FLOORS.has(tile)) continue;
    const [c, r] = key.split(',').map(Number);
    add(difficult, c, r);
  }

  // Props: de vakjes waar ze echt getekend staan (zoals bij tegenhouden).
  const walls = buildBlockers(map);
  for (const p of map.props) {
    const set = DIFFICULT_PROPS.has(p.tile) ? difficult : CLIMB_PROPS.has(p.tile) ? climb : null;
    if (!set) continue;
    for (const [c, r] of layoutCells(propLayout(p, walls))) add(set, c, r);
  }

  const info = { difficult, climb };
  cache.set(map, info);
  return info;
}
