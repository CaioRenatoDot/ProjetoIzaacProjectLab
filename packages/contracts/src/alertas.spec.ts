import { describe, expect, it } from 'vitest';

import {
  Alerta,
  AlertaNormalizado,
  ConsultarAlertasQuery,
  EscalonamentoEntrada,
  PERMISSOES,
  respostaPaginada,
} from './index';

const id = '01900000-0000-7000-8000-000000000001';
const em = '2026-10-28T10:00:00-03:00';
const medida = {
  id,
  alertaId: id,
  acao: 'REFORCO_ATENDENTE',
  observacao: null,
  acionadoPor: 'Gestão fictícia',
  acionadoEm: em,
};
const alerta = {
  id,
  tipo: 'SLA_EXCEDIDO',
  status: 'ATIVO',
  filaId: id,
  especialidade: 'Fisioterapia',
  tempoEsperaMinutos: 32,
  limiteMinutos: 25,
  senhasAfetadas: 3,
  disparadoEm: em,
  reconhecidoPor: null,
  reconhecidoEm: null,
  normalizadoEm: null,
  escalonamentos: [medida],
};

describe('alertas (UC-19, RF-11, RN-10)', () => {
  it('UC-19 consulta e histórico exigem medidas com autor e horário', () => {
    const dados = [alerta, { ...alerta, status: 'NORMALIZADO', normalizadoEm: em }];
    const lista = { dados, meta: { pagina: 1, tamanho: 20, total: 2, totalPaginas: 1 } };
    expect(respostaPaginada(Alerta).parse(lista)).toEqual(lista);
    expect(Alerta.safeParse({ ...alerta, escalonamentos: undefined }).success).toBe(false);
    for (const campo of ['acionadoPor', 'acionadoEm'])
      expect(
        Alerta.safeParse({ ...alerta, escalonamentos: [{ ...medida, [campo]: undefined }] })
          .success,
      ).toBe(false);
  });

  it('RN-10 bloqueio permite tempos nulos e zero senhas, sem perder o histórico', () => {
    const bloqueio = {
      ...alerta,
      tipo: 'FILA_BLOQUEADA',
      tempoEsperaMinutos: null,
      limiteMinutos: null,
      senhasAfetadas: 0,
    };
    expect(Alerta.parse(bloqueio)).toEqual(bloqueio);
    for (const campo of ['tempoEsperaMinutos', 'limiteMinutos', 'senhasAfetadas'])
      for (const valor of [-1, 1.5])
        expect(Alerta.safeParse({ ...alerta, [campo]: valor }).success).toBe(false);
  });

  it('RNF-02 alerta e medidas recusam identificação e campos clínicos extras', () => {
    for (const campo of [
      'pacienteId',
      'nomeCompleto',
      'motivo',
      'justificativaClinica',
      'observacoes',
    ]) {
      expect(Alerta.safeParse({ ...alerta, [campo]: 'sigiloso' }).success).toBe(false);
      expect(
        Alerta.safeParse({ ...alerta, escalonamentos: [{ ...medida, [campo]: 'sigiloso' }] })
          .success,
      ).toBe(false);
    }
  });

  it('RF-11 limita as medidas e impede forjar autor ou horário no corpo', () => {
    for (const acao of ['REFORCO_ATENDENTE', 'VAGA_EXTRA']) {
      expect(EscalonamentoEntrada.parse({ acao })).toEqual({ acao });
      expect(EscalonamentoEntrada.parse({ acao, observacao: '  Ajuste operacional  ' })).toEqual({
        acao,
        observacao: 'Ajuste operacional',
      });
    }
    for (const entrada of [{}, { acao: 'OUTRA' }, { acao: 'VAGA_EXTRA', observacao: null }])
      expect(EscalonamentoEntrada.safeParse(entrada).success).toBe(false);
    for (const campo of ['acionadoPor', 'acionadoEm', 'status', 'alertaId'])
      expect(EscalonamentoEntrada.safeParse({ acao: 'VAGA_EXTRA', [campo]: em }).success).toBe(
        false,
      );
  });

  it('UC-19 aceita status repetido e paginação 20 com teto 100, recusando filtros inválidos', () => {
    expect(ConsultarAlertasQuery.parse({})).toMatchObject({ pagina: 1, tamanho: 20 });
    expect(ConsultarAlertasQuery.parse({ status: 'ATIVO' }).status).toEqual(['ATIVO']);
    expect(
      ConsultarAlertasQuery.parse({
        status: ['ATIVO', 'RECONHECIDO'],
        filaId: id,
        pagina: '2',
        tamanho: '100',
      }),
    ).toMatchObject({ status: ['ATIVO', 'RECONHECIDO'], filaId: id, pagina: 2, tamanho: 100 });
    for (const query of [
      { status: 'OUTRO' },
      { filaId: 'inválida' },
      { pagina: 0 },
      { tamanho: 101 },
    ])
      expect(ConsultarAlertasQuery.safeParse(query).success).toBe(false);
  });

  it('UC-19 compara o período pelo instante real, mesmo com fusos diferentes', () => {
    for (const query of [
      { de: em },
      { ate: em },
      { de: em, ate: '2026-10-28T13:00:00Z' },
      { de: '2026-10-28T10:00:00+03:00', ate: '2026-10-28T08:00:00Z' },
    ])
      expect(ConsultarAlertasQuery.safeParse(query).success).toBe(true);
    expect(ConsultarAlertasQuery.safeParse({ de: em, ate: '2026-10-28T12:59:59Z' }).success).toBe(
      false,
    );
    for (const de of ['2026-02-30T10:00:00Z', '2026-10-28', '2026-10-28T10:00:00'])
      expect(ConsultarAlertasQuery.safeParse({ de }).success).toBe(false);
  });

  it('UC-19 evento de normalização exige ID e horário com fuso, sem campos extras', () => {
    const evento = { alertaId: id, normalizadoEm: em };
    expect(AlertaNormalizado.parse(evento)).toEqual(evento);
    for (const entrada of [
      { alertaId: id },
      { ...evento, pacienteId: id },
      { ...evento, normalizadoEm: '2026-10-28T10:00:00' },
    ])
      expect(AlertaNormalizado.safeParse(entrada).success).toBe(false);
  });

  it('mantém as três permissões do catálogo', () => {
    expect(PERMISSOES).toEqual(
      expect.arrayContaining(['alertas:consultar', 'alertas:reconhecer', 'alertas:escalonar']),
    );
  });
});
