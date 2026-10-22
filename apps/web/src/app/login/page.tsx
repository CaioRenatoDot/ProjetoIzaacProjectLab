import { type Metadata } from 'next';

import { TelaLogin } from '@/components/login/tela-login';

export const metadata: Metadata = { title: 'Entrar — Gestão de Filas' };

interface PaginaLoginProps {
  searchParams: Promise<{ redirect?: string | string[]; expirada?: string | string[] }>;
}

const primeiro = (valor: string | string[] | undefined) =>
  Array.isArray(valor) ? valor[0] : valor;

/** W-01. `NEXT_PUBLIC_TERMINAL_COMPARTILHADO=true` desabilita "Manter conectado" no terminal. */
export default async function PaginaLogin({ searchParams }: PaginaLoginProps) {
  const parametros = await searchParams;
  return (
    <TelaLogin
      redirect={primeiro(parametros.redirect)}
      expirada={primeiro(parametros.expirada) === '1'}
      terminalCompartilhado={process.env.NEXT_PUBLIC_TERMINAL_COMPARTILHADO === 'true'}
    />
  );
}
