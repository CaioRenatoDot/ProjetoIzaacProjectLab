import { z } from 'zod';

import { StatusSenha, TipoAtendimento } from './enums';
import { Meta, ParametrosPaginacao } from './paginacao';
import { SenhaResumo } from './senhas';

const booleanoDaQuery = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .transform((valor) => valor === 'true');

/** Fila de uma especialidade (RF-04). `bloqueio` é a fonte única do banner de P-04 (RN-10). */
export const Fila = z.object({
  id: z.string(),
  nome: z.string(),
  especialidadeId: z.string(),
  especialidade: z.string(),
  /** Letra do número da senha (F de F014). */
  letraSenha: z.string(),
  ativa: z.boolean(),
  /** Em vigor: o da fila ou, sem ele, o parâmetro da especialidade ou da unidade. */
  slaMinutos: z.number().int(),
  toleranciaMinutos: z.number().int(),
  bloqueio: z.object({
    ativo: z.boolean(),
    motivo: z.string().nullable(),
    desde: z.string().nullable(),
  }),
});
export type Fila = z.infer<typeof Fila>;

export const FilaEntrada = z.object({
  nome: z
    .string({ error: 'Informe o nome da fila.' })
    .trim()
    .min(1, { error: 'Informe o nome da fila.' })
    .max(80, { error: 'O nome tem no máximo 80 caracteres.' }),
  especialidadeId: z.uuid({ error: 'Escolha a especialidade.' }),
  letraSenha: z
    .string({ error: 'Informe a letra da senha.' })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]$/, { error: 'Use uma letra de A a Z.' }),
  ativa: z.boolean({ error: 'Use verdadeiro ou falso.' }).default(true),
  /** Sem valor, vale o parâmetro `sla_minutos` da especialidade ou da unidade. */
  slaMinutos: z
    .number({ error: 'Informe o SLA em minutos.' })
    .int({ error: 'Informe um número inteiro de minutos.' })
    .min(1, { error: 'O SLA é de pelo menos 1 minuto.' })
    .optional(),
});
export type FilaEntrada = z.infer<typeof FilaEntrada>;

export const ListarFilasQuery = ParametrosPaginacao.extend({
  especialidadeId: z.uuid({ error: 'especialidadeId inválido.' }).optional(),
  ativa: booleanoDaQuery.optional(),
});
export type ListarFilasQuery = z.infer<typeof ListarFilasQuery>;

/** Status que o quadro mostra quando `status` não vem: os que ainda estão na fila ou em curso. */
export const STATUS_DO_QUADRO = [
  'AGUARDANDO',
  'CHAMADA',
  'AGUARDANDO_RECURSO',
  'EM_ATENDIMENTO',
  'PAUSADO',
  'PENDENTE_VALIDACAO',
] as const satisfies readonly StatusSenha[];

/** `status` aceita repetição (`status=A&status=B`) ou lista separada por vírgula. */
export const QuadroFilaQuery = ParametrosPaginacao.extend({
  status: z
    .union([z.string(), z.array(z.string())])
    .transform((valor) => (Array.isArray(valor) ? valor : valor.split(',')).filter(Boolean))
    .pipe(z.array(StatusSenha))
    .optional(),
  tipoAtendimento: TipoAtendimento.optional(),
});
export type QuadroFilaQuery = z.infer<typeof QuadroFilaQuery>;

export const MetricasFila = z.object({
  aguardando: z.number().int(),
  chamadas: z.number().int(),
  emAtendimento: z.number().int(),
  ausenciasHoje: z.number().int(),
  /** Média de chegada até a chamada das senhas chamadas hoje; nula sem chamada no dia. */
  tempoMedioEsperaMinutos: z.number().int().nullable(),
});
export type MetricasFila = z.infer<typeof MetricasFila>;

/** `GET /filas/{id}/senhas`: ordenação fixa da RN-04, sem conteúdo clínico (P-03). */
export const QuadroFila = z.object({
  fila: Fila,
  metricas: MetricasFila,
  dados: z.array(SenhaResumo),
  meta: Meta,
  sincronizadoEm: z.string(),
});
export type QuadroFila = z.infer<typeof QuadroFila>;

export const Chamada = z.object({
  id: z.string(),
  senhaId: z.string(),
  numero: z.string(),
  local: z.string(),
  /** 1 = primeira chamada; 2 ou mais = rechamadas. */
  sequencia: z.number().int(),
  chamadoEm: z.string(),
  chamadoPor: z.string(),
});
export type Chamada = z.infer<typeof Chamada>;

export const ChamarProximaEntrada = z
  .object({
    /** Texto do telão (ex.: "Sala 03"); sem valor, o nome da fila. */
    localExibicao: z
      .string()
      .trim()
      .max(60, { error: 'No máximo 60 caracteres.' })
      .transform((valor) => valor || undefined)
      .optional(),
  })
  .default({});
export type ChamarProximaEntrada = z.infer<typeof ChamarProximaEntrada>;

export const ResultadoChamada = z.object({
  senha: SenhaResumo,
  chamada: Chamada,
  /** Urgente chamada antes de senha não urgente que chegou antes (confirmação de T-09, RN-03). */
  furouFilaPorUrgencia: z.boolean(),
  toleranciaAte: z.string(),
});
export type ResultadoChamada = z.infer<typeof ResultadoChamada>;
