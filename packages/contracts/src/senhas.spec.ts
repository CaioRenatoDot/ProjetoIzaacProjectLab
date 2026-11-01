import { describe, expect, it } from 'vitest';

import {
  ConsultarSenhaQuery,
  EmitirSenhaEntrada,
  ParametrosVigentes,
  ReclassificarEntrada,
  SenhaResumo,
} from './index';

describe('senhas', () => {
  it('emissão usa a triagem e assume sem agendamento prévio (RN-04)', () => {
    expect(EmitirSenhaEntrada.parse({ triagemId: '0190a000-0000-7000-8000-000000000001' })).toEqual(
      { triagemId: '0190a000-0000-7000-8000-000000000001', temAgendamentoPrevio: false },
    );
  });

  it('RN-01 justificativa ausente chega ao servidor como texto vazio', () => {
    expect(ReclassificarEntrada.parse({ prioridade: 'URGENTE', versao: 2 }).justificativa).toBe('');
  });

  it('reclassificação exige a versão', () => {
    expect(
      ReclassificarEntrada.safeParse({ prioridade: 'URGENTE', justificativa: 'x' }).success,
    ).toBe(false);
  });

  it('incluirTriagem é falso por padrão', () => {
    expect(ConsultarSenhaQuery.parse({})).toEqual({ incluirTriagem: false });
    expect(ConsultarSenhaQuery.parse({ incluirTriagem: 'true' })).toEqual({ incluirTriagem: true });
  });

  it('a projeção de resumo não tem campo clínico nem nome (ADR-003)', () => {
    for (const campo of ['pacienteNome', 'pacienteId', 'triagem', 'motivo', 'observacoes']) {
      expect(SenhaResumo.shape).not.toHaveProperty(campo);
    }
  });

  it('expõe os seis parâmetros da Tabela 8', () => {
    expect(Object.keys(ParametrosVigentes.shape)).toHaveLength(6);
  });
});
