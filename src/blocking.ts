// Alles wat een gesleept token tegenhoudt: muren en deuren (movement.ts) én grote props.
//
// Een prop houdt tegen op de vakjes waar hij echt getekend staat (props-layout.ts),
// dus een trog van 2×1 op C7 blokkeert C7 en D7. Bij een boom alleen de stam (midden).
// Props die volledig in de mist liggen, houden niet tegen: anders verklapt de app iets.

import { isCellHidden } from './fog';
import { type Blockers, buildBlockers, cellKey } from './movement';
import { layoutCells, propLayout } from './props-layout';
import type { MapData } from './schema';
import { BLOCKING_PROPS, TRUNK_PROPS } from './tiles/palette';

export function buildAllBlockers(map: MapData): Blockers {
  const b = buildBlockers(map);
  const cells = new Set<string>();
  for (const p of map.props) {
    const trunk = TRUNK_PROPS.has(p.tile);
    if (!trunk && !BLOCKING_PROPS.has(p.tile)) continue;
    const l = propLayout(p, b);
    let list = layoutCells(l).filter(([c, r]) => c >= 0 && r >= 0 && c < map.cols && r < map.rows);
    if (trunk) {
      // Alleen het vakje onder het midden van de tekening.
      const a = (l.rot * Math.PI) / 180;
      const mx = l.box.x + l.box.w / 2, my = l.box.y + l.box.h / 2;
      const gx = l.cx + mx * Math.cos(a) - my * Math.sin(a);
      const gy = l.cy + mx * Math.sin(a) + my * Math.cos(a);
      list = [[Math.floor(gx / 64), Math.floor(gy / 64)]];
    }
    if (list.every(([c, r]) => isCellHidden(map, { c, r }))) continue;
    for (const [c, r] of list) cells.add(cellKey(c, r));
  }
  b.cells = cells;
  return b;
}
