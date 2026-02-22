import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    testTimeout: 30000,
    // Run test files sequentially to avoid DB conflicts
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    // Use a single pool
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
