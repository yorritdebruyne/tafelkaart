// Bundel voor gebruik zonder dev-server (Raspberry Pi, offline, later printen en tv).
//
// Gebruik:  npm run fa-bundle
// Dat bouwt de app (map dist/) en kopieert de FA-afbeeldingen uit de index naar dist/fa/.
// dist/ werkt daarna op zichzelf: zet de map op de Pi, of bekijk ze met  npm run preview.
//
// LET OP: dist/ bevat dan FA-afbeeldingen (alleen persoonlijk gebruik). Niet online zetten,
// niet op GitHub (dist/ staat in .gitignore). Thuis in je eigen netwerk is prima.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexPaths } from './fa-match.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = join(root, '.env.local');
const m = existsSync(env) ? /^\s*FA_DIR\s*=\s*"?([^"\r\n]+)"?\s*$/m.exec(readFileSync(env, 'utf8')) : null;
const faDir = m ? resolve(m[1].trim()) : null;
const indexFile = join(root, 'src/tiles/prive/fa-index.json');
const dist = join(root, 'dist');

if (!faDir || !existsSync(faDir)) {
  console.error('FA-map niet gevonden. Draai eerst:  npm run fa-index -- "C:\\ForgottonAdventures"');
  process.exit(1);
}
if (!existsSync(indexFile)) {
  console.error('Geen FA-index. Draai eerst:  npm run fa-index');
  process.exit(1);
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error('Geen build gevonden in dist/. (npm run fa-bundle bouwt eerst; draai het opnieuw.)');
  process.exit(1);
}

const paths = indexPaths(JSON.parse(readFileSync(indexFile, 'utf8')));
let copied = 0;
let bytes = 0;
let missing = 0;
for (const p of paths) {
  const from = join(faDir, ...p.split('/'));
  const to = join(dist, 'fa', ...p.split('/'));
  if (!existsSync(from)) { missing++; continue; }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied++;
  bytes += statSync(from).size;
}
console.log(`${copied} FA-bestanden gekopieerd naar dist/fa (${(bytes / 1e6).toFixed(0)} MB).${missing ? ` ${missing} niet gevonden: draai npm run fa-index opnieuw.` : ''}`);
console.log('Klaar. Bekijken:  npm run preview   (of zet de map dist/ op je Raspberry Pi).');
