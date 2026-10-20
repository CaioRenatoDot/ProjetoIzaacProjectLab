import { type INestApplication } from '@nestjs/common';

import { requestIdMiddleware } from './common/middleware/request-id.middleware';

/** Prefixo de versão da API (docs/04-contrato-api.md §1). */
export const PREFIXO_GLOBAL = 'api/v1';

/**
 * Configuração HTTP compartilhada entre o main.ts e os testes de integração,
 * para que os testes exercitem a mesma aplicação que sobe de verdade.
 */
export function configurarApp(app: INestApplication): void {
  // Registrado antes das rotas para que até o 404 carregue o X-Request-Id.
  app.use(requestIdMiddleware);
  app.setGlobalPrefix(PREFIXO_GLOBAL);
}
