import { describe, expect, it } from 'vitest';

import { ListarTriagensQuery, prioridadeEfetiva, TriagemEntrada, TriagemResumo } from './index';

const ficha = {
  pacienteId: '0190a000-0000-7000-8000-000000000001',
  especialidadeDestinoId: '0190a000-0000-7000-8000-000000000002',
  tipoAtendimento: 'PRIMEIRA_CONSULTA',
  prioridade: 'NORMAL',
  motivo: 'Dor lombar ha duas semanas',
};

describe('triagem', () => {
  it('RN-03 urgência sem justificativa clínica aponta o campo', () => {
    const resultado = TriagemEntrada.safeParse({ ...ficha, prioridade: 'URGENTE' });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['justificativaClinica']);
  });

  it('RN-03 justificativa só com espaços conta como ausente', () => {
    const resultado = TriagemEntrada.safeParse({
      ...ficha,
      prioridade: 'URGENTE',
      justificativaClinica: '   ',
    });

    expect(resultado.success).toBe(false);
  });

  it('RN-03 aceita urgência justificada', () => {
    expect(
      TriagemEntrada.safeParse({
        ...ficha,
        prioridade: 'URGENTE',
        justificativaClinica: 'Sangramento ativo',
      }).success,
    ).toBe(true);
  });

  it('exige motivo e aceita enquadramento de valor único', () => {
    expect(TriagemEntrada.safeParse({ ...ficha, motivo: ' ' }).success).toBe(false);
    expect(TriagemEntrada.safeParse({ ...ficha, enquadramentoLegal: ['IDOSO'] }).success).toBe(
      false,
    );
    expect(TriagemEntrada.parse({ ...ficha, enquadramentoLegal: 'IDOSO' }).enquadramentoLegal).toBe(
      'IDOSO',
    );
  });

  it.each([
    ['NORMAL', 'IDOSO', 'PREFERENCIAL'],
    ['PREFERENCIAL', 'GESTANTE', 'PREFERENCIAL'],
    ['URGENTE', 'PCD', 'URGENTE'],
    ['NORMAL', undefined, 'NORMAL'],
  ] as const)('RN-02 %s com enquadramento %s vira %s', (escolhida, enquadramento, esperada) => {
    expect(prioridadeEfetiva(escolhida, enquadramento)).toBe(esperada);
  });

  it('a projeção de lista não tem campo clínico (ADR-003)', () => {
    for (const campo of ['motivo', 'justificativaClinica', 'observacoes', 'enquadramentoLegal']) {
      expect(TriagemResumo.shape).not.toHaveProperty(campo);
    }
  });

  it('recusa período invertido na listagem', () => {
    expect(ListarTriagensQuery.safeParse({ de: '2026-10-20', ate: '2026-10-01' }).success).toBe(
      false,
    );
    expect(ListarTriagensQuery.parse({ emAberto: 'true' }).emAberto).toBe(true);
  });
});
