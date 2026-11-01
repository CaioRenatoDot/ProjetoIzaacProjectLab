import { z } from 'zod';

import { OrigemDesistencia } from './enums';
import { SenhaResumo } from './senhas';

/** `POST /senhas/{id}/desistencia` (UC-17). Motivo opcional. */
export const DesistenciaEntrada = z.object({
  origem: OrigemDesistencia,
  motivo: z
    .string()
    .trim()
    .max(500, { error: 'No máximo 500 caracteres.' })
    .transform((valor) => valor || undefined)
    .optional(),
  versao: z.number({ error: 'Informe a versão.' }).int({ error: 'Informe a versão.' }),
});
export type DesistenciaEntrada = z.infer<typeof DesistenciaEntrada>;

export const DesistenciaResposta = z.object({
  senha: SenhaResumo,
  /** Verdadeiro quando havia alocação vigente (desistência em atendimento). */
  recursosLiberados: z.boolean(),
});
export type DesistenciaResposta = z.infer<typeof DesistenciaResposta>;
