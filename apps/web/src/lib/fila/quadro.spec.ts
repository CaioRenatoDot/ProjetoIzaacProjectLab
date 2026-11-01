import { describe, expect, it } from 'vitest';

import {
  agruparPorColuna,
  COLUNAS_QUADRO,
  novasChamadas,
  proximaFuraFila,
  textoMinutos,
} from './quadro';
import { type SenhaResumo } from './tipos';

function senha(dados: Partial<SenhaResumo> & Pick<SenhaResumo, 'numero'>): SenhaResumo {
  return {
    id: dados.numero,
    filaId: 'f',
    especialidade: 'Nutrição',
    pacienteIniciais: 'A. B.',
    prioridade: 'NORMAL',
    tipoAtendimento: 'PRIMEIRA_CONSULTA',
    status: 'AGUARDANDO',
    posicao: null,
    chegadaEm: '2026-10-24T08:00:00-03:00',
    chamadaEm: null,
    toleranciaAte: null,
    tempoEsperaMinutos: 0,
    slaExcedido: false,
    temAgendamentoPrevio: false,
    versao: 1,
    ...dados,
  };
}

describe('quadro por status (T-09)', () => {
  it('tem as cinco colunas da T-09, na ordem da tela', () => {
    expect(COLUNAS_QUADRO.map((c) => c.rotulo)).toEqual([
      'Aguardando',
      'Chamada',
      'Em atendimento',
      'Pausado',
      'Pendente de validação',
    ]);
  });

  it('RN-04: mantém a ordem da API em cada coluna, sem reordenar no cliente', () => {
    const daApi = [
      senha({ numero: 'N103', prioridade: 'URGENTE' }),
      senha({ numero: 'N102', prioridade: 'PREFERENCIAL' }),
      senha({ numero: 'N104' }),
      senha({ numero: 'N105', status: 'CHAMADA' }),
      senha({ numero: 'N101' }),
    ];
    const [aguardando] = agruparPorColuna(daApi);
    expect(aguardando?.senhas.map((s) => s.numero)).toEqual(['N103', 'N102', 'N104', 'N101']);
  });

  it('"Aguardando recurso" fica na coluna "Chamada"; status finais ficam fora do quadro', () => {
    const colunas = agruparPorColuna([
      senha({ numero: 'A', status: 'AGUARDANDO_RECURSO' }),
      senha({ numero: 'B', status: 'AUSENTE' }),
      senha({ numero: 'C', status: 'ENCERRADO' }),
    ]);
    expect(colunas.find((c) => c.coluna.id === 'chamada')?.senhas.map((s) => s.numero)).toEqual([
      'A',
    ]);
    expect(colunas.flatMap((c) => c.senhas)).toHaveLength(1);
  });
});

describe('proximaFuraFila', () => {
  it('RN-03: urgente que chegou depois de outra senha pede confirmação', () => {
    const proxima = proximaFuraFila([
      senha({ numero: 'U', prioridade: 'URGENTE', chegadaEm: '2026-10-24T09:00:00-03:00' }),
      senha({ numero: 'N', chegadaEm: '2026-10-24T08:00:00-03:00' }),
    ]);
    expect(proxima?.numero).toBe('U');
  });

  it('RN-03: urgente que já seria a próxima pela chegada não pede confirmação', () => {
    expect(
      proximaFuraFila([
        senha({ numero: 'U', prioridade: 'URGENTE', chegadaEm: '2026-10-24T07:00:00-03:00' }),
        senha({ numero: 'N', chegadaEm: '2026-10-24T08:00:00-03:00' }),
      ]),
    ).toBeNull();
  });

  it('próxima não urgente não pede confirmação', () => {
    expect(proximaFuraFila([senha({ numero: 'P', prioridade: 'PREFERENCIAL' })])).toBeNull();
    expect(proximaFuraFila([])).toBeNull();
  });
});

describe('novasChamadas', () => {
  it('só as senhas que passaram a "Chamada" desde a leitura anterior', () => {
    const antes = [senha({ numero: 'A', status: 'CHAMADA' }), senha({ numero: 'B' })];
    const depois = [
      senha({ numero: 'A', status: 'CHAMADA' }),
      senha({ numero: 'B', status: 'CHAMADA' }),
    ];
    expect(novasChamadas(antes, depois).map((s) => s.numero)).toEqual(['B']);
  });
});

describe('textoMinutos', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [75, '1 h 15 min'],
  ])('%i → %s', (minutos, texto) => {
    expect(textoMinutos(minutos)).toBe(texto);
  });
});
