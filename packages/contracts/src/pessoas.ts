import { z } from 'zod';

import { ItemReferencia } from './cadastros';
import { Turno, VinculoPaciente } from './enums';
import { Aviso } from './erros';
import { ParametrosPaginacao } from './paginacao';

const direcao = z.enum(['asc', 'desc'], { error: 'Use asc ou desc.' }).default('asc');
const ordenarPorNome = z.enum(['nome'], { error: 'Ordene por nome.' }).default('nome');
const booleanoDaQuery = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .transform((valor) => valor === 'true');
const nome = (rotulo: string) =>
  z
    .string({ error: `Informe o ${rotulo}.` })
    .trim()
    .min(1, { error: `Informe o ${rotulo}.` })
    .max(120, { error: `O ${rotulo} tem no máximo 120 caracteres.` });
const idsObrigatorios = (mensagem: string) =>
  z
    .array(z.uuid({ error: mensagem }), { error: mensagem })
    .min(1, { error: mensagem })
    .transform((ids) => [...new Set(ids)]);
const idsOpcionais = (mensagem: string) =>
  z
    .array(z.uuid({ error: mensagem }))
    .default([])
    .transform((ids) => [...new Set(ids)]);

/** Schema `Disponibilidade`: dia da semana de 0 (domingo) a 6 (sábado) e turno. */
export const Disponibilidade = z.object({
  diaSemana: z
    .number({ error: 'Informe o dia da semana.' })
    .int()
    .min(0, { error: 'Dia da semana de 0 (domingo) a 6 (sábado).' })
    .max(6, { error: 'Dia da semana de 0 (domingo) a 6 (sábado).' }),
  turno: Turno,
});
export type Disponibilidade = z.infer<typeof Disponibilidade>;

/** Pares repetidos de dia e turno contam uma vez. */
const listaDisponibilidade = z
  .array(Disponibilidade)
  .transform((lista) => [
    ...new Map(lista.map((item) => [`${item.diaSemana}-${item.turno}`, item])).values(),
  ]);

// ── Paciente (Tabela 1) ──

export const Paciente = z.object({
  id: z.string(),
  nomeCompleto: z.string(),
  iniciais: z.string(),
  documento: z.string(),
  dataNascimento: z.string(),
  contatoTelefone: z.string().nullable(),
  contatoEmail: z.string().nullable(),
  vinculo: VinculoPaciente,
  restricaoAtiva: z.boolean(),
  restricaoAte: z.string().nullable(),
  ativo: z.boolean(),
});
export type Paciente = z.infer<typeof Paciente>;

/** `GET /pacientes/{id}`: com o aviso de reincidência (RN-13). */
export const PacienteDetalhe = Paciente.extend({
  ausenciasUltimos90Dias: z.number().int(),
  avisos: z.array(Aviso),
});
export type PacienteDetalhe = z.infer<typeof PacienteDetalhe>;

export const PacienteEntrada = z.object({
  nomeCompleto: nome('nome completo'),
  // Só os dígitos: "123.456.789-00" e "12345678900" são o mesmo documento.
  documento: z
    .string({ error: 'Informe o documento.' })
    .transform((valor) => valor.replace(/\D/g, ''))
    .pipe(
      z
        .string()
        .min(1, { error: 'Informe o documento com números.' })
        .max(20, { error: 'O documento tem no máximo 20 dígitos.' }),
    ),
  dataNascimento: z.iso
    .date({ error: 'Informe a data de nascimento no formato AAAA-MM-DD.' })
    .refine((data) => data <= new Date().toISOString().slice(0, 10), {
      error: 'A data de nascimento não pode estar no futuro.',
    }),
  contatoTelefone: z.string().trim().max(20, { error: 'No máximo 20 caracteres.' }).optional(),
  contatoEmail: z.email({ error: 'Informe um e-mail válido.' }).optional(),
  vinculo: VinculoPaciente,
});
export type PacienteEntrada = z.infer<typeof PacienteEntrada>;

export const ListarPacientesQuery = ParametrosPaginacao.extend({
  busca: z.string().trim().optional(),
  vinculo: VinculoPaciente.optional(),
  comRestricao: booleanoDaQuery.optional(),
  ordenar: ordenarPorNome,
  direcao,
});
export type ListarPacientesQuery = z.infer<typeof ListarPacientesQuery>;

// ── Estudante ou atendente (Tabela 2, RN-05, RN-06) ──

export const Estudante = z.object({
  id: z.string(),
  nome: z.string(),
  especialidadeId: z.string(),
  especialidade: z.string(),
  nivelFormacao: z.string(),
  habilitacoes: z.array(ItemReferencia),
  procedimentosAutorizados: z.array(ItemReferencia),
  disponibilidade: z.array(Disponibilidade),
  ocupado: z.boolean(),
  ativo: z.boolean(),
});
export type Estudante = z.infer<typeof Estudante>;

export const EstudanteEntrada = z.object({
  nome: nome('nome'),
  especialidadeId: z.uuid({ error: 'Selecione uma especialidade válida.' }),
  nivelFormacao: z
    .string({ error: 'Informe o nível de formação.' })
    .trim()
    .min(1, { error: 'Informe o nível de formação.' })
    .max(60, { error: 'No máximo 60 caracteres.' }),
  habilitacoesIds: idsObrigatorios('Selecione ao menos uma habilitação.'),
  procedimentosIds: idsObrigatorios('Selecione ao menos um procedimento.'),
  disponibilidade: listaDisponibilidade.refine((lista) => lista.length > 0, {
    error: 'Informe ao menos um dia e turno de disponibilidade.',
  }),
});
export type EstudanteEntrada = z.infer<typeof EstudanteEntrada>;

export const ListarEstudantesQuery = ParametrosPaginacao.extend({
  busca: z.string().trim().optional(),
  especialidadeId: z.uuid({ error: 'Informe uma especialidade válida.' }).optional(),
  nivelFormacao: z.string().trim().optional(),
  turno: Turno.optional(),
  disponivel: booleanoDaQuery.optional(),
  ordenar: ordenarPorNome,
  direcao,
});
export type ListarEstudantesQuery = z.infer<typeof ListarEstudantesQuery>;

// ── Supervisor (Tabela 3, RN-07, RN-08) ──

export const Supervisor = z.object({
  id: z.string(),
  nome: z.string(),
  especialidades: z.array(ItemReferencia),
  procedimentos: z.array(ItemReferencia),
  disponibilidade: z.array(Disponibilidade),
  limiteEstudantesSimultaneos: z.number().int(),
  ocupacaoAtual: z.number().int(),
  ativo: z.boolean(),
});
export type Supervisor = z.infer<typeof Supervisor>;

export const SupervisorEntrada = z.object({
  nome: nome('nome'),
  especialidadesIds: idsObrigatorios('Selecione ao menos uma especialidade.'),
  procedimentosIds: idsOpcionais('Selecione procedimentos válidos.'),
  disponibilidade: listaDisponibilidade.default([]),
  limiteEstudantesSimultaneos: z
    .number({ error: 'Informe o limite de estudantes simultâneos.' })
    .int({ error: 'Informe um número inteiro.' })
    .min(1, { error: 'O limite é de pelo menos 1 estudante.' }),
});
export type SupervisorEntrada = z.infer<typeof SupervisorEntrada>;

export const ListarSupervisoresQuery = ParametrosPaginacao.extend({
  busca: z.string().trim().optional(),
  especialidadeId: z.uuid({ error: 'Informe uma especialidade válida.' }).optional(),
  turno: Turno.optional(),
  disponivel: booleanoDaQuery.optional(),
  ordenar: ordenarPorNome,
  direcao,
});
export type ListarSupervisoresQuery = z.infer<typeof ListarSupervisoresQuery>;
