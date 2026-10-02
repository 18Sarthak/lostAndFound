import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    sequence: { concurrent: false }, // Tests within a file run sequentially
    fileParallelism: false,          // Test FILES also run sequentially (shared DB)
  },
});
