import { type INestApplication } from '@nestjs/common';

import { ProblemaFilter } from './common/errors/problema.filter';
import { HEADER_REQUEST_ID, requestIdMiddleware } from './common/middleware/request-id.middleware';

/** Prefixo de versão da API (docs/04-contrato-api.md §1). */
export const PREFIXO_GLOBAL = 'api/v1';

export interface OpcoesApp {
  /** Origens liberadas no CORS; sem a lista, o CORS fica desligado. */
  origensCors?: string[];
}

/**
 * Configuração HTTP compartilhada entre o main.ts e os testes de integração,
 * para que os testes exercitem a mesma aplicação que sobe de verdade.
 */
export function configurarApp(app: INestApplication, opcoes: OpcoesApp = {}): void {
  // Registrado antes das rotas para que até o 404 carregue o X-Request-Id.
  app.use(requestIdMiddleware);
  app.setGlobalPrefix(PREFIXO_GLOBAL);
  app.useGlobalFilters(new ProblemaFilter());

  if (opcoes.origensCors?.length) {
    // credentials: o refresh token vai em cookie httpOnly entre portas diferentes (docs/04 §2).
    app.enableCors({
      origin: opcoes.origensCors,
      credentials: true,
      exposedHeaders: [HEADER_REQUEST_ID],
    });
  }
}
