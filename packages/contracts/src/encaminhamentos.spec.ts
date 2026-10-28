import { describe, expect, it } from 'vitest';

import { Encaminhamento, EncaminhamentoEntrada, PERMISSOES } from './index';

const id = '01900000-0000-7000-8000-000000000001';
const interno = { tipo: 'INTERNO', especialidadeDestinoId: id };
const externo = {
  tipo: 'EXTERNO',
  instituicaoDestino: 'Serviço fictício',
  motivo: 'Motivo fictício',
};

describe('encaminhamento (UC-14, UC-15, RF-08)', () => {
  it('UC-14 permite destino válido, motivo opcional e prioridade sugerida', () => {
    expect(EncaminhamentoEntrada.parse(interno)).toEqual(interno);
    expect(
      EncaminhamentoEntrada.parse({
        ...interno,
        motivo: '  Retorno  ',
        prioridadeSugerida: 'PREFERENCIAL',
      }),
    ).toMatchObject({ motivo: 'Retorno', prioridadeSugerida: 'PREFERENCIAL' });
    expect(
      EncaminhamentoEntrada.safeParse({ ...interno, especialidadeDestinoId: 'inválido' }).success,
    ).toBe(false);
  });

  it('UC-15 exige instituição e motivo, inclusive quando só há espaços', () => {
    expect(EncaminhamentoEntrada.parse(externo)).toEqual(externo);
    for (const campo of ['instituicaoDestino', 'motivo']) {
      for (const valor of [undefined, '', '   '])
        expect(EncaminhamentoEntrada.safeParse({ ...externo, [campo]: valor }).success).toBe(false);
    }
  });

  it('RN-03 sugerir urgência exige motivo clínico', () => {
    for (const motivo of [undefined, '', '   '])
      expect(
        EncaminhamentoEntrada.safeParse({ ...interno, prioridadeSugerida: 'URGENTE', motivo })
          .success,
      ).toBe(false);
    expect(
      EncaminhamentoEntrada.parse({
        ...interno,
        prioridadeSugerida: 'URGENTE',
        motivo: ' Necessidade clínica ',
      }),
    ).toMatchObject({ prioridadeSugerida: 'URGENTE', motivo: 'Necessidade clínica' });
  });

  it('recusa tipo desconhecido, mistura de variantes e campos clínicos fora do contrato', () => {
    expect(EncaminhamentoEntrada.safeParse({ ...externo, tipo: 'OUTRO' }).success).toBe(false);
    for (const entrada of [interno, externo])
      expect(
        EncaminhamentoEntrada.safeParse({ ...entrada, triagem: { motivo: 'sigiloso' } }).success,
      ).toBe(false);
    expect(
      EncaminhamentoEntrada.safeParse({ ...interno, instituicaoDestino: 'Serviço' }).success,
    ).toBe(false);
    expect(
      EncaminhamentoEntrada.safeParse({ ...externo, especialidadeDestinoId: id }).success,
    ).toBe(false);
  });

  it('UC-15 resposta externa tem senha nula e preserva apenas os campos previstos', () => {
    const resposta = {
      id,
      atendimentoOrigemId: id,
      tipo: 'EXTERNO',
      especialidadeDestino: null,
      instituicaoDestino: externo.instituicaoDestino,
      motivo: externo.motivo,
      senhaGerada: null,
      avisos: [],
      criadoEm: '2026-10-28T10:00:00-03:00',
    };
    expect(Encaminhamento.parse(resposta)).toEqual(resposta);
    expect(Encaminhamento.safeParse({ ...resposta, observacoes: 'sigiloso' }).success).toBe(false);
  });

  it('RNF-02 senha gerada usa a projeção de resumo, sem identificação ou conteúdo clínico', () => {
    const resposta = {
      id,
      atendimentoOrigemId: id,
      tipo: 'INTERNO',
      especialidadeDestino: 'Fisioterapia',
      instituicaoDestino: null,
      motivo: '',
      avisos: [{ codigo: 'FILA_BLOQUEADA', mensagem: 'Chamada suspensa.' }],
      criadoEm: '2026-10-28T10:00:00-03:00',
      senhaGerada: {
        id,
        numero: 'F001',
        filaId: id,
        especialidade: 'Fisioterapia',
        pacienteIniciais: 'P. F.',
        prioridade: 'NORMAL',
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        status: 'AGUARDANDO',
        posicao: 1,
        chegadaEm: '2026-10-28T10:00:00-03:00',
        chamadaEm: null,
        toleranciaAte: null,
        tempoEsperaMinutos: 0,
        slaExcedido: false,
        temAgendamentoPrevio: false,
        recursoFaltante: null,
        chamadaId: null,
        versao: 1,
        pacienteNome: 'Paciente Fictício',
        triagem: { motivo: 'Conteúdo clínico' },
      },
    };
    const senha = Encaminhamento.parse(resposta).senhaGerada!;
    expect(senha.status).toBe('AGUARDANDO');
    expect(senha).not.toHaveProperty('pacienteNome');
    expect(senha).not.toHaveProperty('triagem');
  });

  it('mantém as permissões de consulta e criação no catálogo', () => {
    expect(PERMISSOES).toContain('encaminhamento:consultar');
    expect(PERMISSOES).toContain('encaminhamento:criar');
  });
});
