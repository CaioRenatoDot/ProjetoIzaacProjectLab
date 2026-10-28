import { z } from 'zod';

import { ParametrosPaginacao } from './paginacao';

export const TipoAlerta = z.enum(['SLA_EXCEDIDO', 'FILA_BLOQUEADA']);
export type TipoAlerta = z.infer<typeof TipoAlerta>;

export const StatusAlerta = z.enum(['ATIVO', 'RECONHECIDO', 'NORMALIZADO']);
export type StatusAlerta = z.infer<typeof StatusAlerta>;

export const AcaoEscalonamento = z.enum(['REFORCO_ATENDENTE', 'VAGA_EXTRA']);
export type AcaoEscalonamento = z.infer<typeof AcaoEscalonamento>;

/** Tabela 21: autor e horário são preenchidos pelo servidor, nunca pelo corpo da requisição. */
export const EscalonamentoEntrada = z
  .object({
    acao: AcaoEscalonamento,
    observacao: z.string().trim().optional(),
  })
  .strict();
export type EscalonamentoEntrada = z.infer<typeof EscalonamentoEntrada>;

const instante = z.iso.datetime({ offset: true });

export const Escalonamento = z
  .object({
    id: z.uuid(),
    alertaId: z.uuid(),
    acao: AcaoEscalonamento,
    observacao: z.string().nullable(),
    acionadoPor: z.string(),
    acionadoEm: instante,
  })
  .strict();
export type Escalonamento = z.infer<typeof Escalonamento>;

/** UC-19, Tabela 20 e RN-10: projeção operacional, sem paciente ou conteúdo clínico. */
export const Alerta = z
  .object({
    id: z.uuid(),
    tipo: TipoAlerta,
    status: StatusAlerta,
    filaId: z.uuid(),
    especialidade: z.string(),
    tempoEsperaMinutos: z.number().int().nonnegative().nullable(),
    limiteMinutos: z.number().int().positive().nullable(),
    senhasAfetadas: z.number().int().nonnegative(),
    disparadoEm: instante,
    reconhecidoPor: z.string().nullable(),
    reconhecidoEm: instante.nullable(),
    normalizadoEm: instante.nullable(),
    escalonamentos: z.array(Escalonamento),
  })
  .strict();
export type Alerta = z.infer<typeof Alerta>;

export const AlertaNormalizado = z
  .object({
    alertaId: z.uuid(),
    normalizadoEm: instante,
  })
  .strict();
export type AlertaNormalizado = z.infer<typeof AlertaNormalizado>;

/** Status repetido na query; de/ate filtram o disparo por instantes inclusivos com fuso. */
export const ConsultarAlertasQuery = ParametrosPaginacao.extend({
  status: z.preprocess(
    (valor) => (typeof valor === 'string' ? [valor] : valor),
    z.array(StatusAlerta).optional(),
  ),
  filaId: z.uuid({ error: 'Informe uma fila válida.' }).optional(),
  de: instante.optional(),
  ate: instante.optional(),
}).refine(({ de, ate }) => !de || !ate || new Date(de).getTime() <= new Date(ate).getTime(), {
  path: ['ate'],
  message: 'ate deve ser igual ou posterior a de.',
});
export type ConsultarAlertasQuery = z.infer<typeof ConsultarAlertasQuery>;
