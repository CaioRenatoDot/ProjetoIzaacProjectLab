import { z } from 'zod';

/** Projeção do endpoint já definido no OpenAPI; não contém dados da senha ou do paciente. */
export const CandidatoAlocacao = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    descricao: z.string(),
    apto: z.boolean(),
    motivoInaptidao: z
      .enum([
        'ATENDIMENTO_ATIVO',
        'ESPECIALIDADE_INCOMPATIVEL',
        'FORA_DO_TURNO',
        'LIMITE_SUPERVISAO_ATINGIDO',
        'RECURSO_INDISPONIVEL_NA_SALA',
      ])
      .nullable(),
    motivoTexto: z.string().nullable(),
  })
  .strict();
export type CandidatoAlocacao = z.infer<typeof CandidatoAlocacao>;
const BlocoAlocacao = z
  .object({
    sugestao: CandidatoAlocacao.nullable(),
    alternativas: z.array(CandidatoAlocacao),
    regrasVerificadas: z.array(z.string()),
  })
  .strict();
export type BlocoAlocacao = z.infer<typeof BlocoAlocacao>;
export const SugestoesAlocacao = z
  .object({
    senhaId: z.uuid(),
    estudante: BlocoAlocacao,
    sala: BlocoAlocacao,
    supervisor: BlocoAlocacao.extend({ aplicavel: z.boolean() }).strict(),
  })
  .strict();
export type SugestoesAlocacao = z.infer<typeof SugestoesAlocacao>;
