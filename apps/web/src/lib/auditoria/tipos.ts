/** Tipos conforme `docs/api/openapi.yaml` (tag "Auditoria"). */

export type OperacaoAuditoria =
  'CRIAR' | 'EDITAR' | 'EXCLUIR' | 'CONSULTAR_SENSIVEL' | 'EXPORTAR' | 'LOGIN' | 'LOGOUT';

export interface EventoAuditoria {
  id: string;
  usuarioNome: string;
  perfilNoMomento: string;
  operacao: OperacaoAuditoria;
  modulo: string;
  entidade: string;
  entidadeId: string | null;
  descricao: string;
  /** Consulta a dado de prontuário: marcação distinta na tabela (RNF-07). */
  sensivel: boolean;
  ocorridoEm: string;
}

export interface EventoAuditoriaDetalhe extends EventoAuditoria {
  /** Presente em reclassificação de prioridade (RN-01). */
  justificativa: string | null;
  origemIp: string;
  userAgent: string;
  requestId: string;
}

/** `Usuario` de `GET /usuarios`, usado só para o filtro por usuário. */
export interface UsuarioResumo {
  id: string;
  nome: string;
  perfilNome: string;
  ativo: boolean;
}
