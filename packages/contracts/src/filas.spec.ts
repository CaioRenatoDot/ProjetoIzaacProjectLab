import { describe, expect, it } from 'vitest';

import { ChamarProximaEntrada, FilaEntrada, QuadroFilaQuery, SenhaResumo } from './index';

describe('filas', () => {
  it('a letra da senha vira maiúscula e aceita só uma letra', () => {
    const base = { nome: 'Fisioterapia', especialidadeId: '0190a000-0000-7000-8000-000000000001' };

    expect(FilaEntrada.parse({ ...base, letraSenha: 'f' })).toMatchObject({
      letraSenha: 'F',
      ativa: true,
    });
    expect(FilaEntrada.safeParse({ ...base, letraSenha: 'FI' }).success).toBe(false);
    expect(FilaEntrada.safeParse({ ...base, letraSenha: '1' }).success).toBe(false);
  });

  it('o quadro aceita status repetido ou separado por vírgula', () => {
    expect(QuadroFilaQuery.parse({ status: 'AGUARDANDO,CHAMADA' }).status).toEqual([
      'AGUARDANDO',
      'CHAMADA',
    ]);
    expect(QuadroFilaQuery.parse({ status: ['PAUSADO'] }).status).toEqual(['PAUSADO']);
    expect(QuadroFilaQuery.safeParse({ status: 'QUALQUER' }).success).toBe(false);
  });

  it('chamar sem corpo usa o local padrão', () => {
    expect(ChamarProximaEntrada.parse(undefined)).toEqual({});
    expect(ChamarProximaEntrada.parse({ localExibicao: ' ' })).toEqual({});
  });

  it('SenhaResumo traz a chamada vigente para rechamar', () => {
    expect(SenhaResumo.shape).toHaveProperty('chamadaId');
  });
});
