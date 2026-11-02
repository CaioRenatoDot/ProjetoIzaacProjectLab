import { handlersIndicadores } from './indicadores';
import { setupWorker } from 'msw/browser';

import { handlersAlertas } from './alertas';
import { handlersAuditoria } from './auditoria';
import { handlersCadastros, handlersCatalogos } from './cadastros';
import { handlers } from './handlers';
import { handlersAusencias } from './ausencias';
import { handlersAlocacao } from './alocacao';
import { handlersAtendimentos } from './atendimentos';
import { handlersEncaminhamentos } from './encaminhamentos';
import { handlersFilas } from './filas';
import { handlersTriagens } from './triagens';

export const worker = setupWorker(
  ...handlers,
  ...handlersIndicadores,
  ...handlersCadastros,
  ...handlersCatalogos,
  ...handlersFilas,
  ...handlersTriagens,
  ...handlersAlocacao,
  ...handlersAtendimentos,
  ...handlersEncaminhamentos,
  ...handlersAusencias,

  ...handlersAuditoria,
  ...handlersAlertas,
);
