import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Headless SwiftShader plus real audio decode is slow; assertions stay simulation-based,
  // but each test gets a wall-clock budget that does not race that decode.
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5173',
    // Native resolution: no software compositing upscale under SwiftShader.
    viewport: { width: 640, height: 360 },
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        // Headless machines have no GPU; SwiftShader provides a software WebGL2 backend.
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
