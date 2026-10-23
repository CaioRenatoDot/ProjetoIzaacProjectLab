import { PREFIXO_ESTADO_LOCAL } from '@/lib/sessao/estado-local';

import { type OperacaoAuditoria } from './tipos';

/** Tamanho de página padrão (`docs/04-contrato-api.md` §5). */
export const TAMANHO_PAGINA = 20;

export const ROTULO_OPERACAO: Record<OperacaoAuditoria, string> = {
  CRIAR: 'Criar',
  EDITAR: 'Editar',
  EXCLUIR: 'Excluir',
  CONSULTAR_SENSIVEL: 'Consultar informação sensível',
  EXPORTAR: 'Exportar',
  LOGIN: 'Entrar no sistema',
  LOGOUT: 'Sair do sistema',
};

export const OPERACOES = Object.keys(ROTULO_OPERACAO) as OperacaoAuditoria[];

/**
 * O contrato não enumera `modulo`; usa os módulos do catálogo de permissões (`docs/04` §3) e
 * `auth` para entrada e saída. Valor desconhecido aparece como veio da API.
 */
export const ROTULO_MODULO: Readonly<Record<string, string>> = {
  auth: 'Autenticação',
  perfis: 'Perfis',
  cadastros: 'Cadastros',
  triagem: 'Triagem',
  senha: 'Senha',
  fila: 'Fila',
  alocacao: 'Alocação',
  atendimento: 'Atendimento',
  encaminhamento: 'Encaminhamento',
  ausencia: 'Ausências',
  indicadores: 'Indicadores',
  alertas: 'Alertas',
  auditoria: 'Auditoria',
};

export const rotuloModulo = (modulo: string) => ROTULO_MODULO[modulo] ?? modulo;

export interface FiltrosAuditoria {
  usuarioId: string;
  /** Datas no formato do `<input type="date">` (AAAA-MM-DD). */
  de: string;
  ate: string;
  operacao: OperacaoAuditoria | '';
  modulo: string;
  /** Identificador do registro afetado (UUID). */
  entidadeId: string;
}

export interface EstadoAuditoria {
  filtros: FiltrosAuditoria;
  pagina: number;
}

export const FILTROS_VAZIOS: FiltrosAuditoria = {
  usuarioId: '',
  de: '',
  ate: '',
  operacao: '',
  modulo: '',
  entidadeId: '',
};

export const ESTADO_INICIAL: EstadoAuditoria = { filtros: FILTROS_VAZIOS, pagina: 1 };

export type ErrosFiltro = Partial<Record<keyof FiltrosAuditoria, string>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarFiltros(filtros: FiltrosAuditoria): ErrosFiltro {
  const erros: ErrosFiltro = {};
  if (filtros.de && filtros.ate && filtros.ate < filtros.de) {
    erros.ate = 'A data final precisa ser igual ou posterior à data inicial.';
  }
  const registro = filtros.entidadeId.trim();
  if (registro && !UUID.test(registro)) {
    erros.entidadeId =
      'Informe o identificador completo do registro, como aparece no detalhe do evento.';
  }
  return erros;
}

export function temFiltroAtivo(filtros: FiltrosAuditoria) {
  return (Object.values(filtros) as string[]).some((valor) => valor.trim() !== '');
}

/** O período vale do início do dia inicial ao fim do dia final, no fuso de quem consulta. */
const inicioDoDia = (data: string) => new Date(`${data}T00:00:00`).toISOString();
const fimDoDia = (data: string) => new Date(`${data}T23:59:59.999`).toISOString();

function parametrosDosFiltros(filtros: FiltrosAuditoria) {
  const parametros = new URLSearchParams();
  if (filtros.usuarioId) parametros.set('usuarioId', filtros.usuarioId);
  if (filtros.modulo) parametros.set('modulo', filtros.modulo);
  if (filtros.operacao) parametros.set('operacao', filtros.operacao);
  const registro = filtros.entidadeId.trim();
  if (registro) parametros.set('entidadeId', registro);
  if (filtros.de) parametros.set('de', inicioDoDia(filtros.de));
  if (filtros.ate) parametros.set('ate', fimDoDia(filtros.ate));
  return parametros;
}

/** Query string de `GET /auditoria`. A ordem é sempre cronológica decrescente (contrato). */
export function montarConsulta(estado: EstadoAuditoria): string {
  const parametros = parametrosDosFiltros(estado.filtros);
  parametros.set('pagina', String(estado.pagina));
  parametros.set('tamanho', String(TAMANHO_PAGINA));
  return `?${parametros.toString()}`;
}

/** Query string de `GET /auditoria/exportacao`: os mesmos filtros da tela, sem paginação. */
export function montarConsultaExportacao(filtros: FiltrosAuditoria): string {
  const consulta = parametrosDosFiltros(filtros).toString();
  return consulta ? `?${consulta}` : '';
}

export function nomeArquivoExportacao(agora: Date) {
  const dia = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');
  return `trilha-auditoria-${dia}.csv`;
}

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export const formatarDataHora = (iso: string) => formatoDataHora.format(new Date(iso));

const CHAVE = `${PREFIXO_ESTADO_LOCAL}auditoria`;

/** Filtros persistem na sessão do usuário (especificação de UI §2.4); a sessão os apaga ao sair. */
export function lerEstadoSalvo(): EstadoAuditoria {
  try {
    const salvo = window.sessionStorage.getItem(CHAVE);
    if (!salvo) return ESTADO_INICIAL;
    const estado = JSON.parse(salvo) as Partial<EstadoAuditoria>;
    return {
      filtros: { ...FILTROS_VAZIOS, ...estado.filtros },
      pagina: estado.pagina ?? 1,
    };
  } catch {
    return ESTADO_INICIAL;
  }
}

export function salvarEstado(estado: EstadoAuditoria) {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // Sem storage disponível, os filtros valem só enquanto a tela estiver aberta.
  }
}
