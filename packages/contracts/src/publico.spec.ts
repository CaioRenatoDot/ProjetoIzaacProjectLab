import { describe, expect, it } from 'vitest';

import { ConsultaSenhaPublica, EstadoPainelPublico, Problema, StatusSenha } from './index';

const chamada = { numero: 'F014', especialidade: 'Fisioterapia', local: 'Sala 03' };
const painel = { atual: chamada, anteriores: [], servidorEm: '2026-10-28T10:00:00-03:00' };
const consulta = {
  numero: 'F015',
  especialidade: 'Fisioterapia',
  status: 'AGUARDANDO',
  posicao: 4,
  tempoEstimadoMinutos: null,
  local: null,
};

describe('contrato HTTP público (#20, UC-08, UC-09)', () => {
  it('RNF-02 recusa dados de paciente e clínicos nas duas projeções públicas', () => {
    for (const campo of [
      'pacienteId',
      'pacienteNome',
      'pacienteIniciais',
      'nomeCompleto',
      'documento',
      'prioridade',
      'triagem',
      'motivo',
      'justificativaClinica',
      'observacoes',
    ]) {
      expect(ConsultaSenhaPublica.safeParse({ ...consulta, [campo]: 'sigiloso' }).success).toBe(
        false,
      );
      expect(EstadoPainelPublico.safeParse({ ...painel, [campo]: 'sigiloso' }).success).toBe(false);
      for (const estado of [
        { ...painel, atual: { ...chamada, [campo]: 'sigiloso' } },
        { ...painel, anteriores: [{ ...chamada, [campo]: 'sigiloso' }] },
      ])
        expect(EstadoPainelPublico.safeParse(estado).success).toBe(false);
    }
  });

  it('UC-08 aceita a posição sem estimativa e a situação dos nove estados da senha', () => {
    expect(ConsultaSenhaPublica.parse(consulta)).toEqual(consulta);
    expect(ConsultaSenhaPublica.safeParse({ ...consulta, tempoEstimadoMinutos: 22 }).success).toBe(
      true,
    );
    for (const status of StatusSenha.options) {
      expect(
        ConsultaSenhaPublica.safeParse({
          ...consulta,
          status,
          posicao: null,
          local: 'Sala 03',
          orientacao: 'Procure a recepção.',
        }).success,
      ).toBe(true);
    }
  });

  it('recusa posição não positiva, estimativa negativa ou fracionária e estado desconhecido', () => {
    for (const invalido of [
      { posicao: 0 },
      { posicao: -1 },
      { posicao: 1.5 },
      { tempoEstimadoMinutos: -1 },
      { tempoEstimadoMinutos: 1.5 },
      { status: 'DESCONHECIDO' },
    ])
      expect(ConsultaSenhaPublica.safeParse({ ...consulta, ...invalido }).success).toBe(false);
  });

  it('UC-09 aceita painel vazio e quatro anteriores, com horário do servidor obrigatório', () => {
    expect(EstadoPainelPublico.safeParse({ ...painel, atual: null }).success).toBe(true);
    expect(
      EstadoPainelPublico.safeParse({ ...painel, anteriores: Array(4).fill(chamada) }).success,
    ).toBe(true);
    expect(
      EstadoPainelPublico.safeParse({ ...painel, anteriores: Array(5).fill(chamada) }).success,
    ).toBe(false);
    expect(EstadoPainelPublico.safeParse({ atual: null, anteriores: [] }).success).toBe(false);
    expect(
      EstadoPainelPublico.safeParse({ ...painel, servidorEm: '2026-10-28T10:00:00' }).success,
    ).toBe(false);
  });

  it('representa o limite de requisições como Problema RFC 7807 com código estável', () => {
    expect(
      Problema.safeParse({
        type: 'about:blank',
        title: 'Limite de requisições atingido',
        status: 429,
        codigo: 'LIMITE_REQUISICOES',
        detail: 'Aguarde antes de consultar novamente.',
      }).success,
    ).toBe(true);
  });
});
