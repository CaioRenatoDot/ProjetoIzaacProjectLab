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

/**
 * Prévia do "Chamar próxima" (#149): sugestões pela especialidade da fila e a senha que vem a
 * seguir pela RN-04. Nada é reservado; a senha só é escolhida, com trava, na chamada.
 */
export const SugestoesChamada = SugestoesAlocacao.omit({ senhaId: true })
  .extend({
    proxima: z.object({ numero: z.string(), prioridade: z.string() }).strict().nullable(),
  })
  .strict();
export type SugestoesChamada = z.infer<typeof SugestoesChamada>;
