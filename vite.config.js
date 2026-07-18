import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    middlewareMode: true,
    // Permite acesso via túneis ngrok (e similares) em development
    allowedHosts: true,
    // Catálogo compartilhado (server/spells.js, monsterTypes.js) importado pelo client
    fs: {
      allow: [rootDir],
    },
  },
});
