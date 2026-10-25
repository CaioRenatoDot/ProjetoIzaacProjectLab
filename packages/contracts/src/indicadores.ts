import { z } from 'zod';

import { Turno } from './enums';

const data = (campo: string) => z.iso.date({ error: `Informe ${campo} no formato AAAA-MM-DD.` });

/** Período em dias inteiros no fuso da unidade, pela chegada da senha (RF-10). */
const periodo = {
  de: data('de'),
  ate: data('ate'),
  turno: Turno.optional(),
};

const periodoValido = <T extends { de: string; ate: string }>(q: T) => q.de <= q.ate;
const mensagemPeriodo = { path: ['ate'], message: 'ate deve ser igual ou posterior a de.' };

export const IndicadoresQuery = z
  .object({
    ...periodo,
    especialidadeId: z.uuid({ error: 'especialidadeId inválido.' }).optional(),
  })
  .refine(periodoValido, mensagemPeriodo);
export type IndicadoresQuery = z.infer<typeof IndicadoresQuery>;

export const VolumeQuery = z.object(periodo).refine(periodoValido, mensagemPeriodo);
export type VolumeQuery = z.infer<typeof VolumeQuery>;

export const ExportarIndicadoresQuery = z
  .object({
    ...periodo,
    especialidadeId: z.uuid({ error: 'especialidadeId inválido.' }).optional(),
    formato: z.enum(['csv'], { error: 'A exportação é em csv.' }).default('csv'),
  })
  .refine(periodoValido, mensagemPeriodo);
export type ExportarIndicadoresQuery = z.infer<typeof ExportarIndicadoresQuery>;

/** UC-18, RF-10. Só agregados por especialidade e período: nenhum identificador de paciente. */
export const IndicadoresResumo = z.object({
  periodo: z.object({ de: z.string(), ate: z.string() }),
  /** Chegada até a primeira chamada. */
  tempoMedioEsperaMinutos: z.number().int().nullable(),
  /** Início ao encerramento, descontadas as pausas. */
  tempoMedioAtendimentoMinutos: z.number().int().nullable(),
  /** Atendimentos com desfecho registrado. */
  pacientesAtendidos: z.number().int(),
  /** Senhas ausentes sobre senhas chamadas, de 0 a 100. */
  taxaAusencia: z.number(),
  desistencias: z.number().int(),
  atendimentosPorEspecialidade: z.array(
    z.object({ especialidadeId: z.string(), especialidade: z.string(), total: z.number().int() }),
  ),
  semDados: z.boolean(),
  /** Menos de 10 atendimentos concluídos: a média pode não ser representativa (T-16). */
  amostraPequena: z.boolean(),
});
export type IndicadoresResumo = z.infer<typeof IndicadoresResumo>;

export const VolumePorEspecialidade = z.object({
  series: z.array(
    z.object({
      especialidadeId: z.string(),
      especialidade: z.string(),
      atendimentos: z.number().int(),
      ausencias: z.number().int(),
      desistencias: z.number().int(),
    }),
  ),
  semDados: z.boolean(),
});
export type VolumePorEspecialidade = z.infer<typeof VolumePorEspecialidade>;
