import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Phaser alone is ~1.2 MB minified (~340 KB gzipped); that's expected for a Phaser game.
    chunkSizeWarningLimit: 1600,
  },
});
