import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/family-board-card.ts',
      formats: ['es'],
      fileName: () => 'family-board-card.js',
    },
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Lit and Rough.js (BSD-3-Clause, MIT) and the Patrick Hand font (OFL-1.1) are bundled; their licences ask for a notice in every copy.
        banner:
          '/*! family-board-card | MIT | bundles Lit (BSD-3-Clause, (c) 2017 Google LLC), Rough.js (MIT, (c) 2019 Preet Shihn) and the font Patrick Hand (OFL-1.1, (c) 2010-2012 Patrick Wagesreiter) | full notices: https://github.com/stempler/family-board/blob/master/THIRD-PARTY-NOTICES.md */',
      },
    },
  },
});
