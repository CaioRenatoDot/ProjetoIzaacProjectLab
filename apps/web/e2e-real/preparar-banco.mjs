/**
 * Recria o banco de testes do zero (migrações + seed) antes de a API subir, para o fluxo real
 * sempre partir da fila vazia. Roda dentro do comando do webServer da API, porque o Playwright
 * sobe os servidores antes do globalSetup.
 *
 * Só roda no `filas_test`, a mesma trava dos testes de integração: um `.env` errado nunca apaga o
 * `filas_dev`.
 */
import { execSync } from 'node:child_process';

for (const nome of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = process.env[nome];
  if (!url || new URL(url).pathname !== '/filas_test') {
    throw new Error(
      `Os testes reais só rodam no banco filas_test; ${nome} aponta para outro banco.`,
    );
  }
}

execSync('pnpm --filter api prisma migrate reset --force --skip-generate', { stdio: 'inherit' });
