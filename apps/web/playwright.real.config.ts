import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { AMBIENTE_REAL, UNIDADE_DO_SEED } from './e2e-real/ambiente';

const RAIZ = path.resolve(__dirname, '../..');
const RELOGIO = path.resolve(__dirname, 'e2e-real/relogio-deslocado.cjs');
const PREPARAR_BANCO = path.resolve(__dirname, 'e2e-real/preparar-banco.mjs');
const TELAS = {
  NEXT_PUBLIC_API_MOCK: 'false',
  NEXT_PUBLIC_API_URL: 'http://localhost:3333/api/v1',
  NEXT_PUBLIC_SOCKET_URL: 'http://localhost:3333',
  NEXT_PUBLIC_UNIDADE_ID: UNIDADE_DO_SEED,
};

/**
 * Fluxo de ponta a ponta com API e banco reais (#52): sem a simulação do MSW. O banco de testes é
 * recriado a cada execução, e os testes rodam em série porque compartilham a mesma fila.
 * Precisa das portas 3000, 3001 e 3333 livres.
 */
export default defineConfig({
  testDir: './e2e-real',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-real' }]]
    : 'list',
  outputDir: 'test-results-real',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      name: 'api',
      command: `node "${PREPARAR_BANCO}" && pnpm --filter api build && node --require "${RELOGIO}" apps/api/dist/main.js`,
      cwd: RAIZ,
      url: 'http://localhost:3333/api/v1/health/ready',
      env: { ...AMBIENTE_REAL, NODE_ENV: 'production' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      name: 'web',
      command: 'pnpm --filter web build && pnpm --filter web start',
      cwd: RAIZ,
      url: 'http://localhost:3000/login',
      env: TELAS,
      reuseExistingServer: false,
      timeout: 300_000,
    },
    {
      name: 'publico',
      command: 'pnpm --filter publico build && pnpm --filter publico start',
      cwd: RAIZ,
      url: 'http://localhost:3001/telao',
      env: TELAS,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
