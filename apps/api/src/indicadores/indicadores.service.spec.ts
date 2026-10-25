import { describe, expect, it } from 'vitest';

import { taxaAusencia } from './indicadores.service';

describe('taxaAusencia (RF-10)', () => {
  it.each([
    [1, 3, 33.3],
    [0, 5, 0],
    [2, 2, 100],
    [0, 0, 0],
  ])('%i ausência(s) em %i chamada(s) dá %d%%', (ausencias, chamadas, esperado) => {
    expect(taxaAusencia({ ausencias, chamadas })).toBe(esperado);
  });
});
