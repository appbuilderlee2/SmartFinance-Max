import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['utils/**/*.test.ts', 'components/**/*.test.ts'],
  },
});
