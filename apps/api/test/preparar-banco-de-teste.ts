import { execSync } from 'node:child_process';

import { garantirBancoDeTeste } from '../src/common/testing/banco-de-teste';

/**
 * Recria o filas_test do zero com as migrações antes da suíte de integração.
 * As migrações rodam com o administrador (DIRECT_URL_TEST); os testes, com o usuário da aplicação.
 */
export default function prepararBancoDeTeste(): void {
  const urlApp = garantirBancoDeTeste(process.env.DATABASE_URL_TEST);
  const urlAdmin = garantirBancoDeTeste(process.env.DIRECT_URL_TEST);
  execSync('prisma migrate reset --force --skip-seed --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: urlApp, DIRECT_URL: urlAdmin },
  });
}
