import { type Permissao } from '@filas/ui';

export interface Modulo {
  rotulo: string;
  rota: string;
  /** Permissão que torna o módulo visível no menu. */
  permissao: Permissao;
}

/**
 * Módulos do menu lateral (ADR-002, Modelo A), na ordem dos wireframes.
 * A visibilidade vem só da permissão, nunca do nome do perfil (docs/04-contrato-api.md §2).
 */
export const MODULOS: readonly Modulo[] = [
  { rotulo: 'Acesso', rota: '/acesso', permissao: 'perfis:consultar' },
  { rotulo: 'Cadastros', rota: '/cadastros', permissao: 'cadastros:consultar' },
  { rotulo: 'Triagem', rota: '/triagem', permissao: 'triagem:consultar' },
  { rotulo: 'Fila', rota: '/fila', permissao: 'fila:consultar' },
  // Não existe módulo "chamada" no catálogo: a chamada é uma operação da fila.
  { rotulo: 'Chamada', rota: '/chamada', permissao: 'fila:chamar' },
  { rotulo: 'Alocação', rota: '/alocacao', permissao: 'alocacao:consultar' },
  { rotulo: 'Atendimento', rota: '/atendimento', permissao: 'atendimento:consultar' },
  { rotulo: 'Encaminhamento', rota: '/encaminhamento', permissao: 'encaminhamento:consultar' },
  { rotulo: 'Ausências', rota: '/ausencias', permissao: 'ausencia:consultar' },
  { rotulo: 'Indicadores', rota: '/indicadores', permissao: 'indicadores:consultar' },
  { rotulo: 'Auditoria', rota: '/auditoria', permissao: 'auditoria:consultar' },
];

export function modulosVisiveis(permissoes: readonly string[]): Modulo[] {
  return MODULOS.filter((m) => permissoes.includes(m.permissao));
}
