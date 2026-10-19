import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the production build works from any static host or file path.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
