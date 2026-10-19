import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// O SWC substitui o esbuild porque o Nest depende de emitDecoratorMetadata para a injeção.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
