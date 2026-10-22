import { describe, expect, it } from 'vitest';

import {
  anunciarMudancas,
  compararLeituras,
  descreverGravidade,
  ordenarParaExibicao,
} from './apresentacao';
import { type Alerta } from './tipos';

function alerta(id: string, parcial: Partial<Alerta> = {}): Alerta {
  return {
    id,
    tipo: 'SLA_EXCEDIDO',
    status: 'ATIVO',
    filaId: `fila-${id}`,
    especialidade: 'Fisioterapia',
    tempoEsperaMinutos: 32,
    limiteMinutos: 25,
    senhasAfetadas: 6,
    disparadoEm: '2026-10-22T10:00:00Z',
    reconhecidoPor: null,
    reconhecidoEm: null,
    normalizadoEm: null,
    ...parcial,
  };
}

describe('descreverGravidade', () => {
  it('descreve em texto quanto a espera passou do limite', () => {
    expect(descreverGravidade(alerta('a'))).toBe(
      'Espera de 32 min, 7 min acima do limite de 25 min',
    );
  });

  it('fila bloqueada é descrita pela causa, sem tempo de espera', () => {
    expect(
      descreverGravidade(
        alerta('a', { tipo: 'FILA_BLOQUEADA', tempoEsperaMinutos: null, limiteMinutos: null }),
      ),
    ).toBe('Chamadas suspensas por ausência de supervisor (RN-10)');
  });

  it('sem os tempos, não inventa números', () => {
    expect(descreverGravidade(alerta('a', { tempoEsperaMinutos: null }))).toBe(
      'Espera acima do limite definido',
    );
  });
});

describe('ordenarParaExibicao', () => {
  it('reconhecido desce para depois dos ativos, sem sair da lista, mantendo a ordem da API', () => {
    const lista = [
      alerta('1', { status: 'RECONHECIDO' }),
      alerta('2'),
      alerta('3', { status: 'RECONHECIDO' }),
      alerta('4'),
    ];
    expect(ordenarParaExibicao(lista).map((a) => a.id)).toEqual(['2', '4', '1', '3']);
  });
});

describe('compararLeituras e anunciarMudancas', () => {
  it('detecta alerta novo e alerta que saiu da lista em aberto', () => {
    const anterior = [alerta('1'), alerta('2', { especialidade: 'Psicologia' })];
    const atual = [
      alerta('1', { status: 'RECONHECIDO' }),
      alerta('3', { especialidade: 'Nutrição', tipo: 'FILA_BLOQUEADA' }),
    ];
    const mudancas = compararLeituras(anterior, atual);

    expect(mudancas.novos.map((a) => a.id)).toEqual(['3']);
    expect(mudancas.normalizados.map((a) => a.id)).toEqual(['2']);
    expect(anunciarMudancas(mudancas)).toBe(
      'Novo alerta: Nutrição, fila bloqueada. O alerta de Psicologia foi normalizado e passou para o histórico.',
    );
  });

  it('reconhecer não é mudança a anunciar', () => {
    const mudancas = compararLeituras([alerta('1')], [alerta('1', { status: 'RECONHECIDO' })]);
    expect(anunciarMudancas(mudancas)).toBe('');
  });
});
