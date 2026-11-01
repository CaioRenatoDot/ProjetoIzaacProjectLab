import { z } from 'zod';

/**
 * `GET /parametros`: valores em vigor da unidade (Tabela 8). Com `especialidadeId`, o valor da
 * especialidade sobrepõe o geral. Nenhum desses números fica fixo no código (docs/01 §4.7).
 */
export const ParametrosVigentes = z.object({
  toleranciaMinutos: z.number().int(),
  slaMinutos: z.number().int(),
  reincidenciasRestricao: z.number().int(),
  janelaReincidenciaDias: z.number().int(),
  limiteEstudantesSupervisor: z.number().int(),
  justificativaMinCaracteres: z.number().int(),
});
export type ParametrosVigentes = z.infer<typeof ParametrosVigentes>;

export const ConsultarParametrosQuery = z.object({
  especialidadeId: z.uuid({ error: 'especialidadeId inválido.' }).optional(),
});
export type ConsultarParametrosQuery = z.infer<typeof ConsultarParametrosQuery>;
