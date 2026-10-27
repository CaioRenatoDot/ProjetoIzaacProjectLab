import { z } from 'zod';

/** Projeção exclusiva do telão: campos de paciente e prioridade são recusados (ADR-003). */
export const ChamadaPublica = z
  .object({
    numero: z.string(),
    especialidade: z.string(),
    local: z.string(),
  })
  .strict();
export type ChamadaPublica = z.infer<typeof ChamadaPublica>;

export const ChamadaExibida = ChamadaPublica.extend({
  sequencia: z.number().int().min(1),
  em: z.iso.datetime({ offset: true }),
}).strict();
export type ChamadaExibida = z.infer<typeof ChamadaExibida>;

/** Reconexão do namespace /painel: chamada atual e até quatro anteriores. */
export const EstadoPainel = z
  .object({
    atual: ChamadaPublica.nullable(),
    anteriores: z.array(ChamadaPublica).max(4),
  })
  .strict();
export type EstadoPainel = z.infer<typeof EstadoPainel>;

export interface EventosPainel {
  'chamada.exibir': ChamadaExibida;
  'painel.estado': EstadoPainel;
}
export type NomeEventoPainel = keyof EventosPainel;
