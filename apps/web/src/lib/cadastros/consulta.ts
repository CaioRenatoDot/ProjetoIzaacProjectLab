import { PREFIXO_ESTADO_LOCAL } from '@/lib/sessao/estado-local';

import { type SlugCadastro } from './entidades';

/** Tamanho de página padrão (`docs/04-contrato-api.md` §5). */
export const TAMANHO_PAGINA = 20;

export type Direcao = 'asc' | 'desc';

export interface EstadoLista {
  busca: string;
  /** Parâmetro do contrato → valor escolhido. Vazio = sem filtro. */
  filtros: Record<string, string>;
  pagina: number;
  ordenar: string | null;
  direcao: Direcao;
}

export const ESTADO_INICIAL: EstadoLista = {
  busca: '',
  filtros: {},
  pagina: 1,
  ordenar: null,
  direcao: 'asc',
};

/** Query string de `GET /<entidade>` (`docs/04` §5). */
export function montarConsulta(estado: EstadoLista): string {
  const parametros = new URLSearchParams({
    pagina: String(estado.pagina),
    tamanho: String(TAMANHO_PAGINA),
  });
  const busca = estado.busca.trim();
  if (busca) parametros.set('busca', busca);
  for (const [nome, valor] of Object.entries(estado.filtros)) {
    if (valor) parametros.set(nome, valor);
  }
  if (estado.ordenar) {
    parametros.set('ordenar', estado.ordenar);
    parametros.set('direcao', estado.direcao);
  }
  return `?${parametros.toString()}`;
}

export function temFiltroAtivo(estado: EstadoLista) {
  return estado.busca.trim() !== '' || Object.values(estado.filtros).some(Boolean);
}

const chave = (slug: SlugCadastro) => `${PREFIXO_ESTADO_LOCAL}cadastros-${slug}`;

/** Filtros persistem na sessão do usuário (T-03); a sessão os apaga ao entrar e ao sair. */
export function lerEstadoSalvo(slug: SlugCadastro): EstadoLista {
  try {
    const salvo = window.sessionStorage.getItem(chave(slug));
    if (!salvo) return ESTADO_INICIAL;
    return { ...ESTADO_INICIAL, ...(JSON.parse(salvo) as Partial<EstadoLista>) };
  } catch {
    return ESTADO_INICIAL;
  }
}

export function salvarEstado(slug: SlugCadastro, estado: EstadoLista) {
  try {
    window.sessionStorage.setItem(chave(slug), JSON.stringify(estado));
  } catch {
    // Sem storage disponível, os filtros valem só enquanto a tela estiver aberta.
  }
}
