import { describe, expect, it } from 'vitest';

import { RegistrarAusenciaEntrada } from './index';

describe('ausência', () => {
  it('confirmação antecipada é falsa por padrão', () => {
    expect(RegistrarAusenciaEntrada.parse({ versao: 2 })).toEqual({
      confirmadoAntesDaTolerancia: false,
      versao: 2,
    });
  });
});
