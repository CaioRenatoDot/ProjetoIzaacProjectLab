import { describe, expect, it } from 'vitest';

import { doBanco, iniciais, normalizarNome, paraBanco } from './pessoas.util';

describe('utilitários de pessoas', () => {
  it.each([
    ['Maria Aparecida da Silva', 'M. A. S.'],
    ['joão dos santos e souza', 'J. S. S.'],
    ['  Ana  ', 'A.'],
  ])('iniciais de %s', (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado);
  });

  it('normaliza espaços repetidos no nome', () => {
    expect(normalizarNome('  Maria   Silva ')).toBe('Maria Silva');
  });

  it('converte o dia da semana entre o contrato (0 a 6) e o banco', () => {
    expect(paraBanco({ diaSemana: 0, turno: 'MANHA' })).toEqual({
      diaSemana: 'DOMINGO',
      turno: 'MANHA',
    });
    expect(doBanco({ diaSemana: 'SABADO', turno: 'NOITE' })).toEqual({
      diaSemana: 6,
      turno: 'NOITE',
    });
  });
});
