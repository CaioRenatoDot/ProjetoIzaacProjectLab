import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { type ReactElement } from 'react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { SessaoProvider } from '@/lib/sessao/sessao';
import { handlersAlertas, reiniciarMockAlertas } from '@/mocks/alertas';
import { handlersAuditoria, reiniciarMockAuditoria } from '@/mocks/auditoria';
import { COOKIE_REFRESH_MOCK } from '@/mocks/cookies';
import { handlersCadastros, handlersCatalogos, reiniciarMockCadastros } from '@/mocks/cadastros';
import { handlers, reiniciarMockAuth } from '@/mocks/handlers';
import { handlersAusencias, reiniciarMockAusencias } from '@/mocks/ausencias';
import { handlersAlocacao, reiniciarMockAlocacao } from '@/mocks/alocacao';
import { handlersAtendimentos, reiniciarMockAtendimentos } from '@/mocks/atendimentos';
import { handlersFilas } from '@/mocks/filas';

export const servidor = setupServer(
  ...handlers,
  ...handlersCadastros,
  ...handlersCatalogos,
  ...handlersFilas,
  ...handlersAlocacao,
  ...handlersAtendimentos,
  ...handlersAusencias,

  ...handlersAuditoria,
  ...handlersAlertas,
);

/** Liga a simulação da API (a mesma do navegador) durante os testes do arquivo. */
export function usarServidorMock() {
  beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    servidor.resetHandlers();
    reiniciarMockAuth();
    reiniciarMockAusencias();
    reiniciarMockAlocacao();
    reiniciarMockAtendimentos();
    reiniciarMockCadastros();
    reiniciarMockAuditoria();
    reiniciarMockAlertas();
    window.sessionStorage.clear();
    document.cookie = `${COOKIE_REFRESH_MOCK}=; Max-Age=0; Path=/`;
  });
  afterAll(() => servidor.close());
}

/** Simula o cookie de refresh de uma sessão anterior (página recarregada). */
export function comSessaoAnterior(usuarioId = 'usuario-admin') {
  document.cookie = `${COOKIE_REFRESH_MOCK}=${usuarioId}; Path=/`;
}

export function renderizarComSessao(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessaoProvider baseUrl={API_URL}>{ui}</SessaoProvider>
    </QueryClientProvider>,
  );
}
