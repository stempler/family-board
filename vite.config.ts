import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/family-board-card.ts',
      formats: ['es'],
      fileName: () => 'family-board-card.js',
    },
    outDir: 'dist',
  },
});
