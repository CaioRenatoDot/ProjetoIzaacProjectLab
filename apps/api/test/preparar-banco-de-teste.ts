import { execSync } from 'node:child_process';

import { garantirBancoDeTeste } from '../src/common/testing/banco-de-teste';

/** Recria o filas_test do zero com as migrações antes da suíte de integração. */
export default function prepararBancoDeTeste(): void {
  const url = garantirBancoDeTeste(process.env.DATABASE_URL_TEST);
  execSync('prisma migrate reset --force --skip-seed --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
