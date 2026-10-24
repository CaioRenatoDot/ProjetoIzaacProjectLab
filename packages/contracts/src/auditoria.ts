import { z } from 'zod';

import { OperacaoAuditoria } from './enums';
import { ParametrosPaginacao } from './paginacao';
import { CATALOGO_PERMISSOES } from './permissoes';

/** Módulos do catálogo e `auth` (LOGIN e LOGOUT). */
export const ModuloAuditoria = z.enum(
  ['auth', ...CATALOGO_PERMISSOES.map(({ modulo }) => modulo)] as [string, ...string[]],
  { error: 'Módulo desconhecido.' },
);
export type ModuloAuditoria = z.infer<typeof ModuloAuditoria>;

/** Schema `EventoAuditoria`. */
export const EventoAuditoria = z.object({
  id: z.string(),
  usuarioNome: z.string(),
  perfilNoMomento: z.string(),
  operacao: OperacaoAuditoria,
  modulo: z.string(),
  entidade: z.string(),
  entidadeId: z.string().nullable(),
  descricao: z.string(),
  sensivel: z.boolean(),
  ocorridoEm: z.string(),
});
export type EventoAuditoria = z.infer<typeof EventoAuditoria>;

export const EventoAuditoriaDetalhe = EventoAuditoria.extend({
  justificativa: z.string().nullable(),
  origemIp: z.string(),
  userAgent: z.string(),
  requestId: z.string(),
});
export type EventoAuditoriaDetalhe = z.infer<typeof EventoAuditoriaDetalhe>;

const dataHora = (campo: string) =>
  z.iso.datetime({ offset: true, error: `Informe ${campo} em data e hora com fuso (ISO-8601).` });

const filtros = {
  usuarioId: z.uuid({ error: 'Informe um usuário válido.' }).optional(),
  modulo: ModuloAuditoria.optional(),
  operacao: OperacaoAuditoria.optional(),
  entidadeId: z.uuid({ error: 'Informe um registro válido.' }).optional(),
};

const periodoCoerente = <T extends { de?: string; ate?: string }>(valor: T) =>
  !valor.de || !valor.ate || valor.de <= valor.ate;

export const ConsultarAuditoriaQuery = ParametrosPaginacao.extend({
  ...filtros,
  de: dataHora('de').optional(),
  ate: dataHora('ate').optional(),
}).refine(periodoCoerente, { error: 'A data inicial não pode ser depois da final.', path: ['de'] });
export type ConsultarAuditoriaQuery = z.infer<typeof ConsultarAuditoriaQuery>;

export const DIAS_MAXIMOS_EXPORTACAO = 366;

/** Exportação: mesmos filtros, período obrigatório de até 366 dias. */
export const ExportarAuditoriaQuery = z
  .object({ ...filtros, de: dataHora('de'), ate: dataHora('ate') })
  .refine(periodoCoerente, { error: 'A data inicial não pode ser depois da final.', path: ['de'] })
  .refine(
    ({ de, ate }) =>
      new Date(ate).getTime() - new Date(de).getTime() <= DIAS_MAXIMOS_EXPORTACAO * 86_400_000,
    { error: `Exporte no máximo ${DIAS_MAXIMOS_EXPORTACAO} dias por vez.`, path: ['ate'] },
  );
export type ExportarAuditoriaQuery = z.infer<typeof ExportarAuditoriaQuery>;
