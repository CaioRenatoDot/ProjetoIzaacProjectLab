import { describe, expect, it } from 'vitest';

import { podeReclassificar, prioridadesDisponiveis } from './reclassificacao';

describe('podeReclassificar', () => {
  it('oferece a reclassificação só para senha ainda não atendida', () => {
    expect(podeReclassificar('AGUARDANDO')).toBe(true);
    expect(podeReclassificar('AGUARDANDO_RECURSO')).toBe(true);
  });

  it('não oferece para senha já chamada ou em atendimento', () => {
    for (const status of ['CHAMADA', 'EM_ATENDIMENTO', 'PAUSADO', 'ENCERRADO'] as const) {
      expect(podeReclassificar(status)).toBe(false);
    }
  });
});

describe('prioridadesDisponiveis', () => {
  it('exclui a prioridade atual', () => {
    expect(prioridadesDisponiveis(['NORMAL', 'PREFERENCIAL', 'URGENTE'], 'PREFERENCIAL')).toEqual([
      'NORMAL',
      'URGENTE',
    ]);
  });
});
