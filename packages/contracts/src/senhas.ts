import { z } from 'zod';

import { ItemReferencia } from './cadastros';
import { Prioridade, StatusSenha, TipoAtendimento } from './enums';
import { Aviso } from './erros';
import { TriagemDetalhe } from './triagem';

const booleanoDaQuery = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .transform((valor) => valor === 'true');

/** Projeção de lista, painel e cartão, sem conteúdo clínico (ADR-003). */
export const SenhaResumo = z.object({
  id: z.string(),
  /** Letra da fila + três dígitos, único por dia e fila (ex.: F014). */
  numero: z.string(),
  filaId: z.string(),
  especialidade: z.string(),
  pacienteIniciais: z.string(),
  prioridade: Prioridade,
  tipoAtendimento: TipoAtendimento,
  status: StatusSenha,
  /** Posição na fila pela RN-04; nula fora de AGUARDANDO. */
  posicao: z.number().int().nullable(),
  chegadaEm: z.string(),
  chamadaEm: z.string().nullable(),
  toleranciaAte: z.string().nullable(),
  tempoEsperaMinutos: z.number().int(),
  slaExcedido: z.boolean(),
  temAgendamentoPrevio: z.boolean(),
  versao: z.number().int(),
});
export type SenhaResumo = z.infer<typeof SenhaResumo>;

export const Alocacao = z.object({
  id: z.string(),
  senhaId: z.string(),
  estudante: ItemReferencia,
  supervisor: ItemReferencia.nullable(),
  sala: ItemReferencia,
  confirmadaEm: z.string(),
  confirmadaPor: z.string(),
  liberadaEm: z.string().nullable(),
});
export type Alocacao = z.infer<typeof Alocacao>;

/** `GET /senhas/{id}?incluirTriagem=true`: sensível, gera CONSULTAR_SENSIVEL. */
export const SenhaDetalhe = SenhaResumo.extend({
  pacienteId: z.string(),
  pacienteNome: z.string(),
  triagem: TriagemDetalhe,
  /** Alocação vigente; nula antes da alocação (UC-10). */
  alocacao: Alocacao.nullable(),
  senhaOrigemId: z.string().nullable(),
});
export type SenhaDetalhe = z.infer<typeof SenhaDetalhe>;

/** Resposta do `POST /senhas`. Fila bloqueada (RN-10) vem como aviso `FILA_BLOQUEADA`. */
export const SenhaEmitida = SenhaResumo.extend({
  posicaoEstimada: z.number().int(),
  avisos: z.array(Aviso),
});
export type SenhaEmitida = z.infer<typeof SenhaEmitida>;

export const EmitirSenhaEntrada = z.object({
  triagemId: z.uuid({ error: 'Escolha a triagem.' }),
  /** Ajustável antes de confirmar a emissão (T-07); padrão: o da triagem. */
  tipoAtendimento: TipoAtendimento.optional(),
  /** Terceiro critério de ordenação (RN-04). */
  temAgendamentoPrevio: z.boolean({ error: 'Use verdadeiro ou falso.' }).default(false),
});
export type EmitirSenhaEntrada = z.infer<typeof EmitirSenhaEntrada>;

export const ConsultarSenhaQuery = z.object({
  incluirTriagem: booleanoDaQuery.default(false),
});
export type ConsultarSenhaQuery = z.infer<typeof ConsultarSenhaQuery>;

/**
 * `PATCH /senhas/{id}/prioridade` (RN-01). Justificativa vazia ou abaixo do parâmetro
 * `justificativaMinCaracteres` volta 422 JUSTIFICATIVA_OBRIGATORIA, validado no servidor.
 */
export const ReclassificarEntrada = z.object({
  prioridade: Prioridade,
  justificativa: z
    .string({ error: 'Informe a justificativa.' })
    .trim()
    .max(2000, { error: 'No máximo 2000 caracteres.' })
    .default(''),
  versao: z.number({ error: 'Informe a versão.' }).int({ error: 'Informe a versão.' }),
});
export type ReclassificarEntrada = z.infer<typeof ReclassificarEntrada>;

export const ReclassificacaoResposta = z.object({
  senha: SenhaResumo,
  novaPosicao: z.number().int().nullable(),
});
export type ReclassificacaoResposta = z.infer<typeof ReclassificacaoResposta>;

/** Item do histórico de reclassificações (W-07). */
export const Reclassificacao = z.object({
  id: z.string(),
  dePrioridade: Prioridade,
  paraPrioridade: Prioridade,
  justificativa: z.string(),
  usuarioNome: z.string(),
  ocorridoEm: z.string(),
});
export type Reclassificacao = z.infer<typeof Reclassificacao>;
