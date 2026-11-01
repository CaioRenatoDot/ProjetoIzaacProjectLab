'use client';

import { useState } from 'react';

import { TelaPerfis } from '@/components/perfis/tela-perfis';
import { USAR_MOCK } from '@/lib/api/config';
import { criarPerfisApiEmMemoria } from '@/lib/perfis/api-em-memoria';
import { criarPerfisHttp } from '@/lib/perfis/api-http';
import { useSessao } from '@/lib/sessao/sessao';

/**
 * W-05. Com a API real, usa o cliente HTTP (#12); na simulação (MSW), que não tem perfis, segue a
 * API em memória, com os dados dos testes Playwright de `e2e/perfis.e2e.ts`.
 */
export default function PaginaPerfis() {
  const { cliente } = useSessao();
  const [api] = useState(() => (USAR_MOCK ? criarPerfisApiEmMemoria() : criarPerfisHttp(cliente)));
  return <TelaPerfis api={api} />;
}
