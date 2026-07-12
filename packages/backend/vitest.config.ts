import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run tests sequentially — they share a MongoDB connection and test DB.
    pool: 'forks',
    singleFork: true,
  },
});
