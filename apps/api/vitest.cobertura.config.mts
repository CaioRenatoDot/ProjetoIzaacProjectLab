import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Só para `vitest list` da verificação de RN (scripts/verificar-cobertura-rn.mjs): coleta os
// casos de unidade e de integração sem o globalSetup, que recria o banco de teste.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'src/**/*.int-spec.ts', 'prisma/**/*.int-spec.ts'],
    environment: 'node',
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
