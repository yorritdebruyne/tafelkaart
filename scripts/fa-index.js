// Maakt de index van Forgotten Adventures: welke afbeeldingen horen bij welke tegel-id.
//
// Gebruik (in de PyCharm-terminal):   npm run fa-index
// De map met FA staat in .env.local:  FA_DIR=C:\ForgottonAdventures
// Eerste keer (maakt .env.local aan):  npm run fa-index -- "C:\ForgottonAdventures"
//
// Resultaat: src/tiles/prive/fa-index.json (staat niet op GitHub).
// Opnieuw draaien na het toevoegen van FA-delen of na een wijziging in src/tiles/fa-map.json.

import { existsSync, openSync, readFileSync, readSync, closeSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { alphaBox, classify, compileMap, relFromFa, sizeFromName, imageSize } from './fa-match.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function faDir() {
  const env = join(root, '.env.local');
  if (process.argv[2]) {
    // Eerste keer met een map erbij: onthoud ze in .env.local (ook de dev-server leest die).
    if (!existsSync(env)) writeFileSync(env, `FA_DIR=${process.argv[2]}\n`);
    return process.argv[2];
  }
  if (existsSync(env)) {
    const m = /^\s*FA_DIR\s*=\s*"?([^"\r\n]+)"?\s*$/m.exec(readFileSync(env, 'utf8'));
    if (m) return m[1].trim();
  }
  return null;
}

function headerOf(path) {
  const fd = openSync(path, 'r');
  const buf = Buffer.alloc(64 * 1024);
  readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  return buf;
}

const given = faDir();
const dir = given ? resolve(given) : null;
if (!dir || !existsSync(dir)) {
  console.error('FA-map niet gevonden. Zet in .env.local een regel zoals:  FA_DIR=C:\\ForgottonAdventures');
  process.exit(1);
}

const map = JSON.parse(readFileSync(join(root, 'src/tiles/fa-map.json'), 'utf8'));
const compiled = compileMap(map);
const wall = Object.fromEntries(Object.entries(map.wall ?? {}).filter(([id]) => !id.startsWith('_')));
const index = { pxPerCell: map.pxPerCell, themes: map.themes, wall, props: {}, floor: {}, walls: {}, doors: {}, decor: {} };

console.log(`FA doorzoeken in ${dir} ...`);
let files = 0;
let used = 0;
for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  files++;
  const full = join(entry.parentPath ?? entry.path, entry.name);
  // Pad vanaf de FA-map (voor de URL) en binnen de bibliotheek (voor de regels).
  const url = full.slice(dir.length).replace(/\\/g, '/').replace(/^\/+/, '');
  const hits = classify(compiled, relFromFa(url));
  if (!hits.length) continue;
  for (const { kind, id, part } of hits) {
    if (kind === 'decor') {
      (index.decor[id] ??= []).push(url);
    } else if (kind === 'doors') {
      const s = sizeFromName(entry.name) ?? { w: 1, h: 1 };
      const d = (index.doors[id] ??= { doors: [], frames: [] });
      (part === 'frame' ? d.frames : d.doors).push([url, s.w, s.h]);
    } else if (kind === 'walls') {
      // Strook of hoekstuk: afmetingen + waar de muur in de afbeelding staat.
      try {
        const png = PNG.sync.read(readFileSync(full));
        const box = alphaBox(png);
        if (!box) continue;
        const w = (index.walls[id] ??= { strips: [], connectors: [] });
        (part === 'connector' ? w.connectors : w.strips).push([url, png.width, png.height, ...box]);
      } catch {
        /* onleesbare PNG */
      }
    } else if (kind === 'props') {
      const s = sizeFromName(entry.name);
      const item = [url, s.w, s.h];
      // Muur-props: ook waar de tekening in het vierkant staat (om ze tegen de muur te schuiven).
      if (wall[id] && entry.name.toLowerCase().endsWith('.png')) {
        try {
          const box = alphaBox(PNG.sync.read(readFileSync(full)));
          if (box) item.push(...box);
        } catch {
          /* onleesbare PNG: dan zonder kader */
        }
      }
      (index.props[id] ??= []).push(item);
    } else {
      const s = imageSize(headerOf(full));
      if (!s) continue;
      (index.floor[id] ??= []).push([url, s.width, s.height]);
    }
  }
  used++;
}

mkdirSync(join(root, 'src/tiles/prive'), { recursive: true });
writeFileSync(join(root, 'src/tiles/prive/fa-index.json'), JSON.stringify(index));
console.log(`${files} bestanden bekeken, ${used} gebruikt.`);
for (const kind of ['props', 'floor', 'walls', 'doors', 'decor']) {
  const ids = Object.keys(map[kind] ?? {}).filter((id) => !id.startsWith('_'));
  const missing = ids.filter((id) => !index[kind][id]);
  console.log(`${kind}: ${ids.length - missing.length}/${ids.length} tegels gevonden${missing.length ? ` (niet: ${missing.join(', ')})` : ''}`);
}
console.log('Klaar: src/tiles/prive/fa-index.json');
