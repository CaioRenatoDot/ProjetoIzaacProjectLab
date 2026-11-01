import { describe, expect, it } from 'vitest';

import { AguardandoRecursoEntrada, AlocacaoEntrada, SenhaResumo } from './index';

const ids = {
  estudanteId: '0190a000-0000-7000-8000-000000000001',
  salaId: '0190a000-0000-7000-8000-000000000002',
};

describe('alocação', () => {
  it('RN-07 supervisor é nulo por padrão (especialidade sem supervisão)', () => {
    expect(AlocacaoEntrada.parse({ ...ids, versao: 2 })).toEqual({
      ...ids,
      supervisorId: null,
      versao: 2,
    });
  });

  it('exige estudante, sala e versão', () => {
    expect(AlocacaoEntrada.safeParse({ salaId: ids.salaId, versao: 1 }).success).toBe(false);
    expect(AlocacaoEntrada.safeParse({ ...ids }).success).toBe(false);
  });

  it('manter aguardando exige o recurso faltante', () => {
    expect(AguardandoRecursoEntrada.safeParse({ versao: 1 }).success).toBe(false);
    expect(
      AguardandoRecursoEntrada.parse({ recursoFaltante: 'SALA', observacao: ' ', versao: 1 }),
    ).toEqual({ recursoFaltante: 'SALA', versao: 1 });
  });

  it('SenhaResumo traz o recurso faltante', () => {
    expect(SenhaResumo.shape).toHaveProperty('recursoFaltante');
  });
});
