import { describe, expect, it } from 'vitest';

import { acoesDoEstado, duracaoAgora, duracaoTexto } from './estado';

const todas = () => true;

describe('acoesDoEstado (T-13)', () => {
  it('alocado só inicia; em atendimento pausa e encerra; pausado só retoma', () => {
    expect(acoesDoEstado('CHAMADA', todas)).toEqual(['iniciar']);
    expect(acoesDoEstado('AGUARDANDO_RECURSO', todas)).toEqual(['iniciar']);
    expect(acoesDoEstado('EM_ATENDIMENTO', todas)).toEqual(['pausar', 'encerrar']);
    expect(acoesDoEstado('PAUSADO', todas)).toEqual(['retomar']);
  });

  it('RN-11: pendente de validação só oferece validar, e só a quem tem atendimento:validar', () => {
    expect(acoesDoEstado('PENDENTE_VALIDACAO', todas)).toEqual(['validar']);
    expect(acoesDoEstado('PENDENTE_VALIDACAO', (p) => p !== 'atendimento:validar')).toEqual([]);
  });

  it('ação sem permissão não aparece, e estados finais não têm ação', () => {
    expect(acoesDoEstado('EM_ATENDIMENTO', (p) => p === 'atendimento:criar')).toEqual([]);
    expect(acoesDoEstado('ENCERRADO', todas)).toEqual([]);
    expect(acoesDoEstado('AGUARDANDO', todas)).toEqual([]);
  });
});

describe('duração', () => {
  it('em texto, com horas a partir de 60 minutos', () => {
    expect(duracaoTexto(0)).toBe('0 min');
    expect(duracaoTexto(12)).toBe('12 min');
    expect(duracaoTexto(65)).toBe('1 h 05 min');
  });

  it('corre só em atendimento; pausado fica no valor da API', () => {
    const lido = Date.parse('2026-10-25T10:00:00Z');
    const depois = lido + 5 * 60_000;
    expect(duracaoAgora({ status: 'EM_ATENDIMENTO', duracaoMinutos: 12 }, lido, depois)).toBe(17);
    expect(duracaoAgora({ status: 'PAUSADO', duracaoMinutos: 12 }, lido, depois)).toBe(12);
  });
});
