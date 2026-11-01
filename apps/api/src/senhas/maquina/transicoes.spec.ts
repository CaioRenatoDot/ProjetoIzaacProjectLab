import { StatusSenha } from '@filas/contracts';
import { describe, expect, it } from 'vitest';

import { horariosDaTransicao, TRANSICOES, transicaoPermitida } from './transicoes';

/** Arestas do diagrama do docs/03 §5, escritas à parte para conferir a tabela do código. */
const ARESTAS_DO_DIAGRAMA: [StatusSenha, StatusSenha, string][] = [
  ['AGUARDANDO', 'CHAMADA', 'UC-09 chamar'],
  ['AGUARDANDO', 'DESISTENCIA', 'UC-17 desistência'],
  ['CHAMADA', 'AGUARDANDO', 'RN-12 retorno à fila por tolerância'],
  ['CHAMADA', 'AUSENTE', 'UC-16 ausência'],
  ['CHAMADA', 'AGUARDANDO_RECURSO', 'UC-10 sem sala compatível'],
  ['CHAMADA', 'EM_ATENDIMENTO', 'UC-11 iniciar'],
  ['AGUARDANDO_RECURSO', 'EM_ATENDIMENTO', 'UC-10 alocar e UC-11 iniciar'],
  ['EM_ATENDIMENTO', 'PAUSADO', 'UC-12 pausar'],
  ['EM_ATENDIMENTO', 'PENDENTE_VALIDACAO', 'RN-11 encerramento exige validação'],
  ['EM_ATENDIMENTO', 'ENCERRADO', 'UC-13 encerrar sem validação'],
  ['EM_ATENDIMENTO', 'DESISTENCIA', 'UC-17 desistência'],
  ['PAUSADO', 'EM_ATENDIMENTO', 'UC-12 retomar'],
  ['PENDENTE_VALIDACAO', 'ENCERRADO', 'RN-11 supervisor valida'],
];

const permitida = (de: StatusSenha, para: StatusSenha) =>
  ARESTAS_DO_DIAGRAMA.some(([a, b]) => a === de && b === para);

const TODOS = StatusSenha.options;
const PROIBIDAS = TODOS.flatMap((de) =>
  TODOS.filter((para) => !permitida(de, para)).map((para) => [de, para] as const),
);

describe('máquina de estados da senha (P-01, docs/03 §5)', () => {
  it.each(ARESTAS_DO_DIAGRAMA)('%s → %s é permitida (%s)', (de, para) => {
    expect(transicaoPermitida(de, para)).toBe(true);
  });

  it.each(PROIBIDAS)('%s → %s é proibida (TRANSICAO_INVALIDA)', (de, para) => {
    expect(transicaoPermitida(de, para)).toBe(false);
  });

  it('cobre a matriz 9 × 9 inteira, sem aresta a mais na tabela', () => {
    expect(ARESTAS_DO_DIAGRAMA.length + PROIBIDAS.length).toBe(81);
    const naTabela = TODOS.flatMap((de) => TRANSICOES[de].map((para) => `${de}>${para}`));
    expect(naTabela.sort()).toEqual(ARESTAS_DO_DIAGRAMA.map(([a, b]) => `${a}>${b}`).sort());
  });

  it('UC-17 desistência só a partir de AGUARDANDO e EM_ATENDIMENTO', () => {
    expect(TODOS.filter((de) => transicaoPermitida(de, 'DESISTENCIA'))).toEqual([
      'AGUARDANDO',
      'EM_ATENDIMENTO',
    ]);
  });

  it('ENCERRADO, AUSENTE e DESISTENCIA são finais', () => {
    for (const final of ['ENCERRADO', 'AUSENTE', 'DESISTENCIA'] as const) {
      expect(TRANSICOES[final]).toEqual([]);
    }
  });
});

describe('horários da transição', () => {
  const agora = new Date('2026-10-25T13:00:00Z');

  it('chamar grava chamada_em e tolerancia_ate pelo parâmetro', () => {
    expect(horariosDaTransicao('AGUARDANDO', 'CHAMADA', agora, 5)).toEqual({
      chamadaEm: agora,
      toleranciaAte: new Date('2026-10-25T13:05:00Z'),
    });
  });

  it('RN-12 retorno à fila limpa a chamada e mantém a chegada', () => {
    const horarios = horariosDaTransicao('CHAMADA', 'AGUARDANDO', agora, 5);
    expect(horarios).toEqual({ chamadaEm: null, toleranciaAte: null });
    expect(horarios).not.toHaveProperty('chegadaEm');
  });

  it('iniciar grava iniciada_em; retomar a pausa não', () => {
    expect(horariosDaTransicao('CHAMADA', 'EM_ATENDIMENTO', agora, 5)).toEqual({
      iniciadaEm: agora,
      toleranciaAte: null,
    });
    expect(horariosDaTransicao('PAUSADO', 'EM_ATENDIMENTO', agora, 5)).toEqual({});
  });

  it.each(['ENCERRADO', 'AUSENTE', 'DESISTENCIA'] as const)('%s grava encerrada_em', (para) => {
    expect(horariosDaTransicao('EM_ATENDIMENTO', para, agora, 5)).toMatchObject({
      encerradaEm: agora,
    });
  });

  it('sair de AGUARDANDO_RECURSO zera o recurso faltante', () => {
    expect(horariosDaTransicao('AGUARDANDO_RECURSO', 'EM_ATENDIMENTO', agora, 5)).toEqual({
      recursoFaltante: null,
      recursoFaltanteObservacao: null,
      iniciadaEm: agora,
      toleranciaAte: null,
    });
  });

  it('RN-11 pendente de validação ainda não encerra', () => {
    expect(horariosDaTransicao('EM_ATENDIMENTO', 'PENDENTE_VALIDACAO', agora, 5)).toEqual({});
  });
});
