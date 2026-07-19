import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

export default defineConfig({
  root: 'client',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
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
