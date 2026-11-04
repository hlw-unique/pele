import { defineConfig } from 'vite';

// A relative base keeps the same build working at /pele/ (project pages), at the domain root
// (user pages) and on a custom domain, so there is nothing to reconfigure before deploying.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    assetsDir: 'assets',
    // pele ships a handful of large per-diagram chunks; they are lazy, not part of the entry.
    chunkSizeWarningLimit: 900,
  },
});
