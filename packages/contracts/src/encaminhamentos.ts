import { z } from 'zod';

import { Prioridade } from './enums';
import { Aviso } from './erros';
import { SenhaResumo } from './senhas';

export const TipoEncaminhamento = z.enum(['INTERNO', 'EXTERNO']);
export type TipoEncaminhamento = z.infer<typeof TipoEncaminhamento>;

/** UC-14: os dados clínicos originais não são alterados pelo registro do encaminhamento. */
export const EncaminhamentoInternoEntrada = z
  .object({
    tipo: z.literal('INTERNO'),
    especialidadeDestinoId: z.uuid({ error: 'Escolha a especialidade de destino.' }),
    motivo: z.string().trim().optional(),
    prioridadeSugerida: Prioridade.optional(),
  })
  .strict()
  .superRefine((entrada, contexto) => {
    if (entrada.prioridadeSugerida === 'URGENTE' && !entrada.motivo) {
      contexto.addIssue({
        code: 'custom',
        path: ['motivo'],
        message: 'Informe o motivo clínico para sugerir prioridade urgente.',
      });
    }
  });
export type EncaminhamentoInternoEntrada = z.infer<typeof EncaminhamentoInternoEntrada>;

/** UC-15: externo exige instituição e motivo, sem gerar senha. */
export const EncaminhamentoExternoEntrada = z
  .object({
    tipo: z.literal('EXTERNO'),
    instituicaoDestino: z
      .string()
      .trim()
      .min(1, { error: 'Informe a instituição ou o serviço de destino.' }),
    motivo: z.string().trim().min(1, { error: 'Informe o motivo do encaminhamento.' }),
    observacoes: z.string().trim().optional(),
  })
  .strict();
export type EncaminhamentoExternoEntrada = z.infer<typeof EncaminhamentoExternoEntrada>;

export const EncaminhamentoEntrada = z.discriminatedUnion('tipo', [
  EncaminhamentoInternoEntrada,
  EncaminhamentoExternoEntrada,
]);
export type EncaminhamentoEntrada = z.infer<typeof EncaminhamentoEntrada>;

/** Resposta individual do registro (Tabela 17); o motivo não pertence a listas nem eventos. */
export const Encaminhamento = z
  .object({
    id: z.uuid(),
    atendimentoOrigemId: z.uuid(),
    tipo: TipoEncaminhamento,
    especialidadeDestino: z.string().nullable(),
    instituicaoDestino: z.string().nullable(),
    motivo: z.string(),
    senhaGerada: SenhaResumo.nullable(),
    avisos: z.array(Aviso),
    criadoEm: z.iso.datetime({ offset: true }),
  })
  .strict();
export type Encaminhamento = z.infer<typeof Encaminhamento>;
