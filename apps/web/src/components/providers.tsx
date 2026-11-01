'use client';

import { EstadoCarregando } from '@filas/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';

import { API_URL, USAR_MOCK } from '@/lib/api/config';
import { ErroApi } from '@/lib/api/cliente-http';
import { SessaoProvider } from '@/lib/sessao/sessao';

function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Erro 4xx não melhora repetindo; falha de rede e 5xx tentam mais uma vez.
        retry: (falhas, erro) =>
          falhas < 1 && !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500),
      },
      mutations: { retry: false },
    },
  });
}

/** Providers da aplicação inteira: TanStack Query, simulação da API (dev) e sessão. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(criarQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SimulacaoApi>
        <SessaoProvider baseUrl={API_URL}>{children}</SessaoProvider>
      </SimulacaoApi>
    </QueryClientProvider>
  );
}

/** Com `USAR_MOCK`, só renderiza depois que o MSW estiver interceptando (`src/mocks`). */
function SimulacaoApi({ children }: { children: ReactNode }) {
  const [pronta, setPronta] = useState(!USAR_MOCK);

  useEffect(() => {
    if (!USAR_MOCK) return;
    void import('@/mocks/browser').then(({ worker }) =>
      worker.start({ onUnhandledRequest: 'bypass', quiet: true }).then(() => setPronta(true)),
    );
  }, []);

  if (!pronta) return <EstadoCarregando rotulo="Preparando a simulação da API" />;
  return <>{children}</>;
}
