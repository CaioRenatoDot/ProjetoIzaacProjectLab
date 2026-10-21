'use client';

import { useState } from 'react';

import { TelaTriagem } from '@/components/triagem/tela-triagem';
import { criarTriagemApiEmMemoria } from '@/lib/triagem/api-em-memoria';

/** W-06 / W-07. A API em memória dá lugar ao cliente HTTP quando #15, #16 e #38 existirem. */
export default function PaginaTriagem() {
  const [api] = useState(() => criarTriagemApiEmMemoria());
  return <TelaTriagem api={api} />;
}
