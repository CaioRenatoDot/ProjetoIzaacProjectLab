'use client';

import { useState } from 'react';

import { TelaPerfis } from '@/components/perfis/tela-perfis';
import { criarPerfisApiEmMemoria } from '@/lib/perfis/api-em-memoria';

/** W-05. A API em memória dá lugar ao cliente HTTP quando a parte 3.6 da API (#12) entrar. */
export default function PaginaPerfis() {
  const [api] = useState(criarPerfisApiEmMemoria);
  return <TelaPerfis api={api} />;
}
