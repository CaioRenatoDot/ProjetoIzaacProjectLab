import { z } from 'zod';

/**
 * Enums do domínio, conforme docs/03-modelo-de-dados.md §1.
 * Cada enum é um schema Zod (validação no servidor e no formulário) e um tipo inferido de mesmo nome.
 * Os valores ficam acessíveis em `StatusSenha.enum.AGUARDANDO` e a lista em `StatusSenha.options`.
 */

/** Os nove status da senha (Tabela 11, ID07, do Documento de Requisitos). */
export const StatusSenha = z.enum([
  'AGUARDANDO',
  'CHAMADA',
  'AGUARDANDO_RECURSO',
  'EM_ATENDIMENTO',
  'PAUSADO',
  'PENDENTE_VALIDACAO',
  'ENCERRADO',
  'AUSENTE',
  'DESISTENCIA',
]);
export type StatusSenha = z.infer<typeof StatusSenha>;

export const Prioridade = z.enum(['NORMAL', 'PREFERENCIAL', 'URGENTE']);
export type Prioridade = z.infer<typeof Prioridade>;

export const TipoAtendimento = z.enum(['PRIMEIRA_CONSULTA', 'RETORNO', 'ENCAIXE']);
export type TipoAtendimento = z.infer<typeof TipoAtendimento>;

/** Preenchido torna a prioridade PREFERENCIAL (RN-02). Valor único (Tabela 9, ID07). */
export const EnquadramentoLegal = z.enum([
  'IDOSO',
  'GESTANTE',
  'LACTANTE',
  'PCD',
  'OUTRO_PREVISTO_EM_NORMA',
]);
export type EnquadramentoLegal = z.infer<typeof EnquadramentoLegal>;

export const VinculoPaciente = z.enum(['EXTERNO', 'ALUNO', 'SERVIDOR']);
export type VinculoPaciente = z.infer<typeof VinculoPaciente>;

/** Turno de disponibilidade de estudante e supervisor (RN-05, RN-07). */
export const Turno = z.enum(['MANHA', 'TARDE', 'NOITE'], {
  error: 'Escolha manhã, tarde ou noite.',
});
export type Turno = z.infer<typeof Turno>;

/** Operações registradas na trilha de auditoria (docs/03 §1). */
export const OperacaoAuditoria = z.enum(
  ['CRIAR', 'EDITAR', 'EXCLUIR', 'CONSULTAR_SENSIVEL', 'EXPORTAR', 'LOGIN', 'LOGOUT'],
  { error: 'Operação de auditoria desconhecida.' },
);
export type OperacaoAuditoria = z.infer<typeof OperacaoAuditoria>;
