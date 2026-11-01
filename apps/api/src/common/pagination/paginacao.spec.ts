import { describe, expect, it } from 'vitest';

import { deslocamento, montarRespostaPaginada } from './paginacao';

describe('paginação', () => {
  it('calcula skip e take a partir da página', () => {
    expect(deslocamento({ pagina: 3, tamanho: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it('monta a meta com o total de páginas arredondado para cima', () => {
    expect(montarRespostaPaginada([], 41, { pagina: 1, tamanho: 20 }).meta).toEqual({
      pagina: 1,
      tamanho: 20,
      total: 41,
      totalPaginas: 3,
    });
  });

  it('lista vazia tem zero páginas', () => {
    expect(montarRespostaPaginada([], 0, { pagina: 1, tamanho: 20 }).meta.totalPaginas).toBe(0);
  });
});
