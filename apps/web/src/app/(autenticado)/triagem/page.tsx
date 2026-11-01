'use client';

import { useState } from 'react';

import { TelaTriagem } from '@/components/triagem/tela-triagem';
import { USAR_MOCK } from '@/lib/api/config';
import { useSessao } from '@/lib/sessao/sessao';
import { criarTriagemApiEmMemoria } from '@/lib/triagem/api-em-memoria';
import { criarTriagemHttp } from '@/lib/triagem/api-http';

/**
 * W-06 / W-07. Com a API real, usa o cliente HTTP; na simulação (MSW), que não tem triagem nem
 * senha, segue a API em memória, com os dados dos testes Playwright de `e2e/triagem.e2e.ts`.
 */
export default function PaginaTriagem() {
  const { cliente } = useSessao();
  const [api] = useState(() =>
    USAR_MOCK ? criarTriagemApiEmMemoria() : criarTriagemHttp(cliente),
  );
  return <TelaTriagem api={api} />;
}
