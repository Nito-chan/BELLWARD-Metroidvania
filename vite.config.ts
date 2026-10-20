import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the production build works from any static host or file path.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    // Playwright writes reports under the project root; without this Vite sees the HTML
    // churn as an app change and can reload the page mid-test.
    watch: {
      ignored: ['**/playwright-report/**', '**/test-results/**', '**/dist/**'],
    },
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
