import { describe, expect, it } from 'vitest';

import { ExportarIndicadoresQuery, IndicadoresQuery, IndicadoresResumo } from './index';

describe('indicadores', () => {
  it('exige o período e recusa período invertido', () => {
    expect(IndicadoresQuery.safeParse({}).success).toBe(false);
    expect(IndicadoresQuery.safeParse({ de: '2026-10-20', ate: '2026-10-01' }).success).toBe(false);
    expect(IndicadoresQuery.safeParse({ de: '2026-10-01', ate: '2026-10-01' }).success).toBe(true);
  });

  it('exporta só em csv', () => {
    expect(ExportarIndicadoresQuery.parse({ de: '2026-10-01', ate: '2026-10-31' }).formato).toBe(
      'csv',
    );
    expect(
      ExportarIndicadoresQuery.safeParse({ de: '2026-10-01', ate: '2026-10-31', formato: 'xlsx' })
        .success,
    ).toBe(false);
  });

  it('o resumo não tem identificador de paciente (RNF-02)', () => {
    expect(
      Object.keys(IndicadoresResumo.shape).some((campo) => /paciente(Id|Nome)/.test(campo)),
    ).toBe(false);
  });
});
