import { defineConfig, devices } from '@playwright/test';

const PORTA = 3000;

/** Testes de ponta a ponta com verificação de acessibilidade (DAS §12.1). */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/aquecer-rotas.ts',
  fullyParallel: true,
  // Fora do CI, mais processos disputam o servidor de desenvolvimento, que compila cada rota na
  // primeira visita, e os testes estouram o tempo.
  workers: process.env.CI ? undefined : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    // Simulação da API (src/mocks) até o login real (#10).
    env: { NEXT_PUBLIC_API_MOCK: 'true' },
    timeout: 120_000,
  },
});
