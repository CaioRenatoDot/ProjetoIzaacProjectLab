import { cookies } from 'next/headers';

import { BLOCOS, INDICADORES } from './home';
import { MODULOS } from './modulos';

/** Dados da sessão exibidos no shell, a partir do access token (docs/04-contrato-api.md §2). */
export interface Sessao {
  nome: string;
  perfilNome: string;
  unidadeNome: string;
  permissoes: readonly string[];
}

/**
 * Cookie que, fora de produção, troca as permissões da sessão provisória (lista separada por
 * vírgula). Existe para os testes de ponta a ponta simularem perfis diferentes antes da #33.
 */
export const COOKIE_PERMISSOES_DEV = 'filas-dev-permissoes';

/**
 * Sessão provisória até a parte 3.3 (#33) entregar login e sessão no front.
 * Ao integrar, trocar esta função pela leitura da sessão real e apagar o cookie de testes.
 */
export async function obterSessao(): Promise<Sessao> {
  const sessao = obterSessaoProvisoria();
  if (process.env.NODE_ENV === 'production') return sessao;
  const permissoesDev = (await cookies()).get(COOKIE_PERMISSOES_DEV)?.value;
  if (permissoesDev === undefined) return sessao;
  return {
    ...sessao,
    perfilNome: 'Perfil de teste',
    permissoes: permissoesDev.split(',').filter(Boolean),
  };
}

export function obterSessaoProvisoria(): Sessao {
  return {
    nome: 'Usuário de desenvolvimento',
    perfilNome: 'Administração',
    unidadeNome: 'Clínica-Escola',
    permissoes: [
      ...new Set([
        ...MODULOS.map((m) => m.permissao),
        ...BLOCOS.flatMap((b) => [b.permissao, ...(b.acao ? [b.acao.permissao] : [])]),
        ...INDICADORES.map((i) => i.permissao),
        'perfis:criar',
        'perfis:editar',
        'perfis:excluir',
      ]),
    ],
  };
}
