import { describe, expect, it } from 'vitest';

import {
  AlteracaoAtiva,
  EspecialidadeEntrada,
  ListarSalasQuery,
  SalaEntrada,
  SituacaoSala,
} from './index';

const RECURSO = '0190a000-0000-7000-8000-000000000001';

describe('cadastros de especialidade e sala', () => {
  it('SalaEntrada assume situação disponível e remove recursos repetidos', () => {
    expect(
      SalaEntrada.parse({ identificacao: ' Sala 1 ', recursosIds: [RECURSO, RECURSO] }),
    ).toEqual({ identificacao: 'Sala 1', recursosIds: [RECURSO], situacao: 'DISPONIVEL' });
  });

  it('situação da sala só aceita os três valores da Tabela 4', () => {
    expect(SituacaoSala.safeParse('OCUPADA').success).toBe(false);
  });

  it('EspecialidadeEntrada exige as duas marcações e tolerância positiva', () => {
    expect(EspecialidadeEntrada.safeParse({ nome: 'Fisioterapia' }).success).toBe(false);
    expect(
      EspecialidadeEntrada.safeParse({
        nome: 'Fisioterapia',
        exigeSupervisaoDocente: true,
        exigeValidacaoEncerramento: false,
        toleranciaMinutos: 0,
      }).success,
    ).toBe(false);
  });

  it('ListarSalasQuery ordena por identificação e recusa campo fora da lista', () => {
    expect(ListarSalasQuery.parse({})).toMatchObject({ ordenar: 'identificacao', direcao: 'asc' });
    expect(ListarSalasQuery.safeParse({ ordenar: 'situacao' }).success).toBe(false);
  });

  it('AlteracaoAtiva exige o booleano', () => {
    expect(AlteracaoAtiva.safeParse({ ativo: false }).success).toBe(false);
    expect(AlteracaoAtiva.parse({ ativa: false })).toEqual({ ativa: false });
  });
});
