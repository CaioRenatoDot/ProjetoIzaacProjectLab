import { z } from 'zod';

import { StatusSenha } from './enums';
import { EstadoPainel } from './eventos-publicos';

/** Resposta HTTP do telão; o horário do servidor não pertence ao evento painel.estado. */
export const EstadoPainelPublico = EstadoPainel.extend({
  servidorEm: z.iso.datetime({ offset: true }),
}).strict();
export type EstadoPainelPublico = z.infer<typeof EstadoPainelPublico>;

/** Consulta do paciente (UC-08), independente de SenhaResumo e SenhaDetalhe (ADR-003). */
export const ConsultaSenhaPublica = z
  .object({
    numero: z.string(),
    especialidade: z.string(),
    status: StatusSenha,
    posicao: z.number().int().min(1).nullable(),
    tempoEstimadoMinutos: z.number().int().min(0).nullable(),
    local: z.string().nullable(),
    orientacao: z.string().optional(),
  })
  .strict();
export type ConsultaSenhaPublica = z.infer<typeof ConsultaSenhaPublica>;
