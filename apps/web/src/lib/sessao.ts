import { MODULOS } from './modulos';

/** Dados da sessão exibidos no shell, a partir do access token (docs/04-contrato-api.md §2). */
export interface Sessao {
  nome: string;
  perfilNome: string;
  unidadeNome: string;
  permissoes: readonly string[];
}

/**
 * Sessão provisória até a parte 3.3 (#33) entregar login e sessão no front.
 * Ao integrar, substituir as chamadas a esta função pela sessão real.
 */
export function obterSessaoProvisoria(): Sessao {
  return {
    nome: 'Usuário de desenvolvimento',
    perfilNome: 'Administração',
    unidadeNome: 'Clínica-Escola',
    permissoes: MODULOS.map((m) => m.permissao),
  };
}
