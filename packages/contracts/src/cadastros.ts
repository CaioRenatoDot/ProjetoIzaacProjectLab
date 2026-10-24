import { z } from 'zod';

import { ParametrosPaginacao } from './paginacao';

/** Schema `ItemReferencia`: cadastros de apoio e referências em listas. */
export const ItemReferencia = z.object({ id: z.string(), nome: z.string() });
export type ItemReferencia = z.infer<typeof ItemReferencia>;

/** Tabela 4, ID04. */
export const SituacaoSala = z.enum(['DISPONIVEL', 'EM_MANUTENCAO', 'INDISPONIVEL'], {
  error: 'Escolha Disponível, Em manutenção ou Indisponível.',
});
export type SituacaoSala = z.infer<typeof SituacaoSala>;

const direcao = z.enum(['asc', 'desc'], { error: 'Use asc ou desc.' }).default('asc');
const booleanoDaQuery = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .transform((valor) => valor === 'true');
const listaDeIds = (campo: string) =>
  z
    .array(z.uuid({ error: `Selecione ${campo} válidos.` }))
    .default([])
    .transform((ids) => [...new Set(ids)]);

/** `PATCH` de situação dos cadastros base (T-03): inativar substitui a exclusão. */
export const AlteracaoAtivo = z.object({
  ativo: z.boolean({ error: 'Informe ativo: true ou false.' }),
});
export type AlteracaoAtivo = z.infer<typeof AlteracaoAtivo>;
export const AlteracaoAtiva = z.object({
  ativa: z.boolean({ error: 'Informe ativa: true ou false.' }),
});
export type AlteracaoAtiva = z.infer<typeof AlteracaoAtiva>;

export const ListarApoioQuery = ParametrosPaginacao.extend({ busca: z.string().trim().optional() });
export type ListarApoioQuery = z.infer<typeof ListarApoioQuery>;

// ── Sala (Tabela 4, RN-09) ──

export const Sala = z.object({
  id: z.string(),
  identificacao: z.string(),
  caracteristicas: z.string(),
  recursos: z.array(ItemReferencia),
  situacao: SituacaoSala,
  ocupada: z.boolean(),
  ativo: z.boolean(),
});
export type Sala = z.infer<typeof Sala>;

export const SalaEntrada = z.object({
  identificacao: z
    .string({ error: 'Informe a identificação da sala.' })
    .trim()
    .min(1, { error: 'Informe a identificação da sala.' })
    .max(60, { error: 'A identificação tem no máximo 60 caracteres.' }),
  caracteristicas: z.string().trim().max(500, { error: 'No máximo 500 caracteres.' }).optional(),
  recursosIds: listaDeIds('recursos'),
  situacao: SituacaoSala.default('DISPONIVEL'),
});
export type SalaEntrada = z.infer<typeof SalaEntrada>;

export const ListarSalasQuery = ParametrosPaginacao.extend({
  busca: z.string().trim().optional(),
  recursoId: z.uuid({ error: 'Informe um recurso válido.' }).optional(),
  disponivel: booleanoDaQuery.optional(),
  ordenar: z
    .enum(['identificacao'], { error: 'Ordene por identificacao.' })
    .default('identificacao'),
  direcao,
});
export type ListarSalasQuery = z.infer<typeof ListarSalasQuery>;

// ── Especialidade ou serviço (Tabela 5, RN-07, RN-09, RN-11, RN-12) ──

export const Especialidade = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string(),
  exigeSupervisaoDocente: z.boolean(),
  exigeValidacaoEncerramento: z.boolean(),
  /** Tolerância própria da especialidade; nulo usa o parâmetro geral da unidade. */
  toleranciaMinutos: z.number().int().nullable(),
  recursosExigidos: z.array(ItemReferencia),
  filasVinculadas: z.number().int(),
  ativa: z.boolean(),
});
export type Especialidade = z.infer<typeof Especialidade>;

export const EspecialidadeEntrada = z.object({
  nome: z
    .string({ error: 'Informe o nome da especialidade.' })
    .trim()
    .min(1, { error: 'Informe o nome da especialidade.' })
    .max(80, { error: 'O nome tem no máximo 80 caracteres.' }),
  descricao: z.string().trim().max(500, { error: 'No máximo 500 caracteres.' }).optional(),
  exigeSupervisaoDocente: z.boolean({ error: 'Informe se exige supervisão docente.' }),
  exigeValidacaoEncerramento: z.boolean({ error: 'Informe se exige validação do encerramento.' }),
  toleranciaMinutos: z
    .number({ error: 'Informe a tolerância em minutos.' })
    .int({ error: 'Informe um número inteiro de minutos.' })
    .min(1, { error: 'A tolerância é de pelo menos 1 minuto.' })
    .optional(),
  recursosExigidosIds: listaDeIds('recursos'),
});
export type EspecialidadeEntrada = z.infer<typeof EspecialidadeEntrada>;

export const ListarEspecialidadesQuery = ParametrosPaginacao.extend({
  busca: z.string().trim().optional(),
  ativa: booleanoDaQuery.optional(),
  exigeSupervisao: booleanoDaQuery.optional(),
  ordenar: z.enum(['nome'], { error: 'Ordene por nome.' }).default('nome'),
  direcao,
});
export type ListarEspecialidadesQuery = z.infer<typeof ListarEspecialidadesQuery>;
