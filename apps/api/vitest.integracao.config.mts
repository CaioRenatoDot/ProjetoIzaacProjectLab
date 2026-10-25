import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Testes contra o PostgreSQL real, só no banco filas_test (garantirBancoDeTeste).
// Rodam com `pnpm --filter api test:integracao`, com o banco do docker compose no ar.
export default defineConfig({
  test: {
    include: ['src/**/*.int-spec.ts', 'prisma/**/*.int-spec.ts'],
    environment: 'node',
    globalSetup: ['test/preparar-banco-de-teste.ts'],
    fileParallelism: false,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
