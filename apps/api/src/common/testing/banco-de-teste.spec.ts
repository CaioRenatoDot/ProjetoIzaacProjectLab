import { describe, expect, it } from 'vitest';

import { garantirBancoDeTeste } from './banco-de-teste';

describe('garantirBancoDeTeste', () => {
  it('aceita o banco filas_test', () => {
    const url = 'postgresql://filas:filas@localhost:5432/filas_test?schema=public';

    expect(garantirBancoDeTeste(url)).toBe(url);
  });

  it.each([
    'postgresql://filas:filas@localhost:5432/filas_dev?schema=public',
    'postgresql://filas:filas@localhost:5432/postgres',
  ])('recusa %s', (url) => {
    expect(() => garantirBancoDeTeste(url)).toThrow(/filas_test/);
  });

  it('recusa URL ausente ou inválida', () => {
    expect(() => garantirBancoDeTeste(undefined)).toThrow(/DATABASE_URL_TEST/);
    expect(() => garantirBancoDeTeste('nao e url')).toThrow(/URL válida/);
  });
});
