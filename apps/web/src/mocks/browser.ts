import { setupWorker } from 'msw/browser';

import { handlersAlertas } from './alertas';
import { handlersAuditoria } from './auditoria';
import { handlersCadastros, handlersCatalogos } from './cadastros';
import { handlers } from './handlers';
import { handlersAusencias } from './ausencias';

export const worker = setupWorker(
  ...handlers,
  ...handlersCadastros,
  ...handlersCatalogos,
  ...handlersAusencias,

  ...handlersAuditoria,
  ...handlersAlertas,
);
