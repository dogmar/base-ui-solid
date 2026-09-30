import * as path from 'node:path';
import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      '@base-ui/utils': path.join(import.meta.dirname, '../utils/src'),
      '@base-ui/solid': path.join(import.meta.dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
        url: 'http://localhost',
      },
    },
    exclude: ['node_modules', 'build', '**/*.spec.*'],
    setupFiles: ['./test/setupVitest.ts'],
    env: {
      VITEST: 'true',
    },
  },
});
