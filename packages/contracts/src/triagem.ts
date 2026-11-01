import { z } from 'zod';

import { EnquadramentoLegal, Prioridade, TipoAtendimento } from './enums';
import { ParametrosPaginacao } from './paginacao';

const booleanoDaQuery = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .transform((valor) => valor === 'true');
const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, { error: `No máximo ${maximo} caracteres.` })
    .transform((valor) => valor || undefined)
    .optional();

const PRECEDENCIA: Record<Prioridade, number> = { NORMAL: 0, PREFERENCIAL: 1, URGENTE: 2 };

/**
 * RN-02: enquadramento legal preenchido sinaliza prioridade PREFERENCIAL. Nunca rebaixa: Urgente
 * (RN-03) continua Urgente. O servidor grava a prioridade efetiva; o formulário usa a mesma função.
 */
export function prioridadeEfetiva(
  escolhida: Prioridade,
  enquadramento: EnquadramentoLegal | null | undefined,
): Prioridade {
  if (!enquadramento) return escolhida;
  return PRECEDENCIA[escolhida] >= PRECEDENCIA.PREFERENCIAL ? escolhida : 'PREFERENCIAL';
}

/** Schema `TriagemEntrada` (W-06 / T-06). `profissional` vem do usuário autenticado. */
export const TriagemEntrada = z
  .object({
    pacienteId: z.uuid({ error: 'Escolha o paciente.' }),
    especialidadeDestinoId: z.uuid({ error: 'Escolha a especialidade de destino.' }),
    tipoAtendimento: TipoAtendimento,
    prioridade: Prioridade,
    motivo: z
      .string({ error: 'Informe o motivo do atendimento.' })
      .trim()
      .min(1, { error: 'Informe o motivo do atendimento.' })
      .max(2000, { error: 'No máximo 2000 caracteres.' }),
    enquadramentoLegal: EnquadramentoLegal.optional(),
    justificativaClinica: textoOpcional(2000),
    observacoes: textoOpcional(2000),
  })
  .superRefine((ficha, ctx) => {
    // RN-03: urgência clínica exige o critério que motivou a priorização.
    if (ficha.prioridade === 'URGENTE' && !ficha.justificativaClinica) {
      ctx.addIssue({
        code: 'custom',
        path: ['justificativaClinica'],
        message: 'Justificativa é obrigatória para prioridade Urgente.',
      });
    }
  });
export type TriagemEntrada = z.infer<typeof TriagemEntrada>;

/** Projeção de lista, sem conteúdo clínico (P-03, ADR-003). */
export const TriagemResumo = z.object({
  id: z.string(),
  pacienteIniciais: z.string(),
  especialidadeId: z.string(),
  especialidade: z.string(),
  tipoAtendimento: TipoAtendimento,
  prioridade: Prioridade,
  concluidaEm: z.string(),
  senhaEmitida: z.boolean(),
});
export type TriagemResumo = z.infer<typeof TriagemResumo>;

/** Resposta do `POST /triagens` e do `GET /triagens/{id}` (sensível, gera CONSULTAR_SENSIVEL). */
export const TriagemDetalhe = TriagemResumo.extend({
  pacienteId: z.string(),
  pacienteNome: z.string(),
  motivo: z.string(),
  enquadramentoLegal: EnquadramentoLegal.nullable(),
  justificativaClinica: z.string().nullable(),
  observacoes: z.string().nullable(),
  profissionalId: z.string(),
});
export type TriagemDetalhe = z.infer<typeof TriagemDetalhe>;

export const ListarTriagensQuery = ParametrosPaginacao.extend({
  pacienteId: z.uuid({ error: 'pacienteId inválido.' }).optional(),
  especialidadeId: z.uuid({ error: 'especialidadeId inválido.' }).optional(),
  emAberto: booleanoDaQuery.optional(),
  de: z.iso.date({ error: 'Informe de no formato AAAA-MM-DD.' }).optional(),
  ate: z.iso.date({ error: 'Informe ate no formato AAAA-MM-DD.' }).optional(),
}).refine((q) => !q.de || !q.ate || q.de <= q.ate, {
  path: ['ate'],
  message: 'ate deve ser igual ou posterior a de.',
});
export type ListarTriagensQuery = z.infer<typeof ListarTriagensQuery>;
