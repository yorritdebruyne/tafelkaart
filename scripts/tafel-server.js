// Kleine server voor zonder Vite (bv. op de Raspberry Pi): toont de gebouwde app uit dist/
// en draait het doorgeefluik voor de tafel. Geen extra bibliotheken nodig.
//
// Gebruik:  npm run fa-bundle   (of npm run build zonder FA)
//           npm run tafel:server            -> http://<ip-van-dit-toestel>:8080
//           PORT=9000 npm run tafel:server  -> andere poort
//
// Alleen in je eigen netwerk of via Tailscale gebruiken: dist/ kan FA-afbeeldingen bevatten
// (alleen persoonlijk gebruik) en iedereen die de server bereikt, kan meespelen.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRelay } from './tafel-relay.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error('Geen build in dist/. Draai eerst:  npm run fa-bundle   (of npm run build)');
  process.exit(1);
}

const relay = createRelay();
const server = createServer((req, res) => {
  relay.handle(req, res, () => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep) && file !== root) {
      res.statusCode = 403;
      return res.end();
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      return res.end('niet gevonden');
    }
    res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
    // index.html nooit cachen (anders zie je een nieuwe versie niet); de rest wel.
    res.setHeader('Cache-Control', file.endsWith('index.html') ? 'no-cache' : 'max-age=86400');
    createReadStream(file).pipe(res);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Tafelkaart draait op poort ${port}. Open op je telefoon of tv:`);
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) console.log(`  http://${a.address}:${port}/   (tv: …/?tv)`);
  }
});
