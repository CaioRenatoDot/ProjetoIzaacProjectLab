import { describe, expect, it } from 'vitest';

import { aplicarChamada, projetarChamada, projetarConsulta, projetarEstado } from './publico';

const chamada = { numero: 'F014', especialidade: 'Fisioterapia', local: 'Sala 03', sequencia: 1 };

describe('projeção pública P-03 / RNF-02', () => {
  it('só número, especialidade, local e sequência chegam ao estado do telão', () => {
    const recebido = {
      ...chamada,
      nomeCompleto: 'DADO_PROIBIDO',
      pacienteId: 'privado',
      prioridade: 'URGENTE',
      motivo: 'DADO_PROIBIDO',
      posicao: 4,
      tempoEstimadoMinutos: 22,
    };
    const atual = projetarChamada(recebido);
    expect(Object.keys(atual).sort()).toEqual(['especialidade', 'local', 'numero', 'sequencia']);
    const estado = projetarEstado({
      atual: recebido,
      anteriores: [recebido],
      paciente: 'DADO_PROIBIDO',
    });
    expect(JSON.stringify(estado)).not.toContain('DADO_PROIBIDO');
    expect(JSON.stringify(estado)).not.toContain('prioridade');
    expect(JSON.stringify(estado)).not.toContain('posicao');
  });

  it('aceita o snapshot HTTP sem sequência e limita o histórico a quatro', () => {
    const publica = { numero: 'F014', especialidade: 'Fisioterapia', local: 'Sala 03' };
    expect(
      projetarEstado({ atual: publica, anteriores: Array.from({ length: 7 }, () => publica) }),
    ).toMatchObject({
      atual: { sequencia: 0 },
      anteriores: Array.from({ length: 4 }, () => ({ ...publica, sequencia: 0 })),
    });
  });

  it('rejeita chamada incompleta, em vez de renderizar payload desconhecido', () => {
    expect(() => projetarChamada({ numero: 'F014', paciente: 'DADO_PROIBIDO' })).toThrow();
    expect(() => projetarEstado({ atual: null, anteriores: 'invalido' })).toThrow();
  });

  it('consulta mantém posição e estimativa em projeção própria e descarta dados privados', () => {
    expect(
      projetarConsulta({
        ...chamada,
        status: 'AGUARDANDO',
        posicao: 4,
        tempoEstimadoMinutos: null,
        nomeCompleto: 'DADO_PROIBIDO',
        prioridade: 'URGENTE',
        orientacao: 'DADO_PROIBIDO',
      }),
    ).toEqual({
      numero: 'F014',
      especialidade: 'Fisioterapia',
      status: 'AGUARDANDO',
      posicao: 4,
      tempoEstimadoMinutos: null,
      local: 'Sala 03',
    });
  });
});

describe('apresentação das chamadas RF-05', () => {
  it('nova chamada desloca a atual e mantém só as quatro anteriores', () => {
    const estado = {
      atual: chamada,
      anteriores: [13, 12, 11, 10].map((n) => ({ ...chamada, numero: `F0${n}` })),
    };
    const novo = aplicarChamada(estado, { ...chamada, numero: 'F015' });
    expect(novo.anteriores.map((c) => c.numero)).toEqual(['F014', 'F013', 'F012', 'F011']);
    expect(estado.atual.numero).toBe('F014');
  });

  it('rechamada atualiza a sequência sem duplicar a senha no histórico', () => {
    const estado = { atual: chamada, anteriores: [{ ...chamada, numero: 'F013' }] };
    const novo = aplicarChamada(estado, { ...chamada, sequencia: 2 });
    expect(novo.atual?.sequencia).toBe(2);
    expect(novo.anteriores).toEqual(estado.anteriores);
    expect(aplicarChamada(novo, { ...chamada, sequencia: 2 })).toBe(novo);
  });
});
