import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CodigoErro,
  ParametrosPaginacao,
  Problema,
  ProblemaValidacao,
  respostaPaginada,
} from './index';

describe('erros', () => {
  it('aceita um Problema com código conhecido', () => {
    const problema = {
      type: 'about:blank',
      title: 'Fila bloqueada',
      status: 409,
      codigo: 'FILA_BLOQUEADA',
    };

    expect(Problema.parse(problema)).toEqual(problema);
  });

  it('recusa código fora do catálogo', () => {
    expect(CodigoErro.safeParse('ERRO_QUALQUER').success).toBe(false);
  });

  it('ProblemaValidacao exige a lista de campos', () => {
    const base = {
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      codigo: 'VALIDACAO',
    };

    expect(ProblemaValidacao.safeParse(base).success).toBe(false);
    expect(
      ProblemaValidacao.safeParse({
        ...base,
        campos: [{ campo: 'nome', mensagem: 'Informe o nome.' }],
      }).success,
    ).toBe(true);
  });
});

describe('paginação', () => {
  it('usa página 1 e tamanho 20 por padrão', () => {
    expect(ParametrosPaginacao.parse({})).toEqual({ pagina: 1, tamanho: 20 });
  });

  it('converte a query string em número', () => {
    expect(ParametrosPaginacao.parse({ pagina: '3', tamanho: '50' })).toEqual({
      pagina: 3,
      tamanho: 50,
    });
  });

  it.each([
    [{ tamanho: '101' }, 'tamanho deve ser no máximo 100.'],
    [{ tamanho: '0' }, 'tamanho deve ser no mínimo 1.'],
    [{ pagina: '0' }, 'pagina deve ser no mínimo 1.'],
    [{ pagina: '1.5' }, 'Informe um número inteiro em pagina.'],
    [{ pagina: 'abc' }, 'Informe um número inteiro em pagina.'],
  ])('recusa %o com mensagem em português', (query, mensagem) => {
    const resultado = ParametrosPaginacao.safeParse(query);

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(mensagem);
  });

  it('respostaPaginada valida dados e meta', () => {
    const schema = respostaPaginada(z.object({ id: z.string() }));
    const resposta = {
      dados: [{ id: 'a' }],
      meta: { pagina: 1, tamanho: 20, total: 1, totalPaginas: 1 },
    };

    expect(schema.parse(resposta)).toEqual(resposta);
  });
});
