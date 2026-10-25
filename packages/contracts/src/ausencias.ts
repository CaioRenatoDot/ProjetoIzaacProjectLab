import { z } from 'zod';

import { SenhaResumo } from './senhas';

/** `POST /senhas/{id}/ausencia` (UC-16). Antes do fim da tolerância, exige confirmação (W-15). */
export const RegistrarAusenciaEntrada = z.object({
  observacao: z
    .string()
    .trim()
    .max(500, { error: 'No máximo 500 caracteres.' })
    .transform((valor) => valor || undefined)
    .optional(),
  confirmadoAntesDaTolerancia: z.boolean({ error: 'Use verdadeiro ou falso.' }).default(false),
  versao: z.number({ error: 'Informe a versão.' }).int({ error: 'Informe a versão.' }),
});
export type RegistrarAusenciaEntrada = z.infer<typeof RegistrarAusenciaEntrada>;

/** RN-13: efeito aplicado quando o paciente atinge a política de reincidência. */
export const RestricaoAplicada = z.object({
  tipo: z.enum(['RESTRICAO_TEMPORARIA', 'CONFIRMACAO_PREVIA']),
  ate: z.string().nullable(),
  descricao: z.string(),
});
export type RestricaoAplicada = z.infer<typeof RestricaoAplicada>;

export const RegistroAusencia = z.object({
  senha: SenhaResumo,
  /** Verdadeiro quando gerada pela expiração da tolerância (RN-12). */
  automatica: z.boolean(),
  recursosLiberados: z.boolean(),
  restricaoAplicada: RestricaoAplicada.nullable(),
});
export type RegistroAusencia = z.infer<typeof RegistroAusencia>;
