import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
// Gewoon JavaScript, zodat het ook zonder Vite werkt (op de Pi). Types: tafel-relay.d.ts.
import { createRelay } from './scripts/tafel-relay.js';

// Forgotten Adventures rechtstreeks uit je eigen map tonen, zonder te kopiëren.
// De map staat in .env.local (niet op GitHub):  FA_DIR=C:\ForgottonAdventures
// De app vraagt een afbeelding op als  fa/<pad binnen die map>.
const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};

function forgottenAdventures(dir: string | undefined): Plugin {
  const root = dir ? resolve(dir) : '';
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    if (!root) return next();
    const url = decodeURIComponent((req.url ?? '').split('?')[0]);
    const file = resolve(root, '.' + url);
    // Veiligheid: nooit iets buiten de FA-map tonen.
    if (!file.startsWith(root + sep) || !TYPES[extname(file).toLowerCase()] || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()]);
    res.setHeader('Cache-Control', 'max-age=86400');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'tafelkaart-forgotten-adventures',
    configureServer: (server) => void server.middlewares.use('/fa', serve),
    configurePreviewServer: (server) => void server.middlewares.use('/fa', serve),
  };
}

// Het doorgeefluik voor de tafel (telefoons + tv gelijk houden): zie scripts/tafel-relay.js.
// Draait mee met  npm run dev  en  npm run tafel  (dan ook bereikbaar vanaf je telefoon).
function tafel(): Plugin {
  const relay = createRelay();
  const use = (server: { middlewares: Connect.Server }) => void server.middlewares.use((req, res, next) => relay.handle(req, res, next));
  return { name: 'tafelkaart-tafel', configureServer: use, configurePreviewServer: use };
}

// base './' = relatieve paden, zodat de build ook werkt in een submap.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    server: { port: 5173 },
    plugins: [forgottenAdventures(env.FA_DIR), tafel()],
  };
});
