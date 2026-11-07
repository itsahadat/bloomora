import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works from any folder (itch.io, GitHub Pages, a sub-path...).
  base: './',
  build: {
    // Phaser alone is ~1.2 MB minified (~340 KB gzipped); that's expected for a Phaser game.
    chunkSizeWarningLimit: 1600,
  },
});
