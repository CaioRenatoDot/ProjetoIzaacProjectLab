import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O tsconfig do Next usa `jsx: preserve`; nos testes o JSX precisa ser transformado.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.mjs'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
