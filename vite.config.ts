import { defineConfig } from 'vite';

// base './' = relatieve paden, zodat de build ook werkt in een submap
// (bv. GitHub Pages op https://<naam>.github.io/tafelkaart/).
export default defineConfig({
  base: './',
  server: { port: 5173 },
});
