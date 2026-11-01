import { describe, expect, it } from 'vitest';

import { ChamadaExibida, ChamadaPublica, EstadoPainel } from './index';

const chamada = { numero: 'F014', especialidade: 'Fisioterapia', local: 'Sala 03' };
const exibida = { ...chamada, sequencia: 1, em: '2026-10-27T10:00:00-03:00' };

describe('contrato do telão (#19, ADR-003)', () => {
  it('RNF-02 recusa identificação de paciente, prioridade e dados clínicos', () => {
    for (const campo of [
      'pacienteId',
      'pacienteNome',
      'pacienteIniciais',
      'prioridade',
      'triagem',
      'motivo',
      'justificativaClinica',
      'observacoes',
    ]) {
      expect(ChamadaPublica.safeParse({ ...chamada, [campo]: 'sigiloso' }).success).toBe(false);
      expect(ChamadaExibida.safeParse({ ...exibida, [campo]: 'sigiloso' }).success).toBe(false);
      expect(
        EstadoPainel.safeParse({ atual: { ...chamada, [campo]: 'sigiloso' }, anteriores: [] })
          .success,
      ).toBe(false);
      expect(
        EstadoPainel.safeParse({ atual: null, anteriores: [{ ...chamada, [campo]: 'sigiloso' }] })
          .success,
      ).toBe(false);
    }
  });

  it('permite painel vazio e limita o histórico a quatro chamadas públicas', () => {
    expect(EstadoPainel.safeParse({ atual: null, anteriores: [] }).success).toBe(true);
    expect(
      EstadoPainel.safeParse({ atual: chamada, anteriores: Array(4).fill(chamada) }).success,
    ).toBe(true);
    expect(
      EstadoPainel.safeParse({ atual: chamada, anteriores: Array(5).fill(chamada) }).success,
    ).toBe(false);
  });

  it('chamada e rechamada exigem sequência positiva e instante com fuso horário', () => {
    expect(ChamadaExibida.safeParse(exibida).success).toBe(true);
    expect(ChamadaExibida.safeParse({ ...exibida, sequencia: 2 }).success).toBe(true);
    expect(ChamadaExibida.safeParse({ ...exibida, sequencia: 0 }).success).toBe(false);
    expect(ChamadaExibida.safeParse({ ...exibida, em: '2026-10-27T10:00:00' }).success).toBe(false);
  });
});
