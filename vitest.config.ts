import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/core/**',
        'src/world/**',
        'src/input/**',
        'src/physics/**',
        'src/player/**',
        'src/render/Camera.ts',
        'src/render/SpriteAnimator.ts',
        'scripts/lib/**',
      ],
      reporter: ['text', 'lcov'],
    },
  },
});
