/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Same-origin Pyodide for the fontTools Worker; see scripts/prepare-pyodide-assets.ts.
    viteStaticCopy({
      targets: [
        {
          src: [
            'node_modules/pyodide/pyodide.asm.mjs',
            'node_modules/pyodide/pyodide.asm.wasm',
            'node_modules/pyodide/pyodide.mjs',
            'node_modules/pyodide/python_stdlib.zip',
            'node_modules/pyodide/pyodide-lock.json',
            '.pyodide-assets/*.whl',
          ],
          dest: 'pyodide',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  optimizeDeps: { exclude: ['pyodide'] },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Keep stray worktree checkouts under .claude/ out of the run.
    include: ['src/**/*.test.ts'],
  },
});
