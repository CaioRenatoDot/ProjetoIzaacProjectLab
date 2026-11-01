import { describe, expect, it } from 'vitest';

import { DesistenciaEntrada } from './index';

describe('desistência', () => {
  it('motivo é opcional e a origem é obrigatória', () => {
    expect(DesistenciaEntrada.parse({ origem: 'PACIENTE', versao: 1 })).toEqual({
      origem: 'PACIENTE',
      versao: 1,
    });
    expect(DesistenciaEntrada.safeParse({ versao: 1 }).success).toBe(false);
    expect(DesistenciaEntrada.safeParse({ origem: 'RECEPCAO', versao: 1 }).success).toBe(false);
  });
});
