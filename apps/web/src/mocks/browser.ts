import { setupWorker } from 'msw/browser';

import { handlersCadastros, handlersCatalogos } from './cadastros';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers, ...handlersCadastros, ...handlersCatalogos);
