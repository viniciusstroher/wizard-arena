import { defineConfig } from 'vite';

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
  },
});
