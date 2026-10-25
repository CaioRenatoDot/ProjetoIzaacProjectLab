import { describe, expect, it } from 'vitest';

import { type AtendimentoCompleto } from './atendimentos.repository';
import { duracaoEfetiva } from './atendimentos.service';

const h = (hora: string) => new Date(`2026-10-26T${hora}:00-03:00`);
const atendimento = (dados: Partial<AtendimentoCompleto>) =>
  ({ iniciadoEm: h('10:00'), encerradoEm: null, pausas: [], ...dados }) as AtendimentoCompleto;

describe('duracaoEfetiva (RF-10)', () => {
  it('desconta as pausas encerradas', () => {
    const resultado = duracaoEfetiva(
      atendimento({
        encerradoEm: h('11:00'),
        pausas: [
          { pausadoEm: h('10:10'), retomadoEm: h('10:20') },
          { pausadoEm: h('10:30'), retomadoEm: h('10:35') },
        ] as AtendimentoCompleto['pausas'],
      }),
      h('12:00'),
    );

    expect(resultado).toBe(45);
  });

  it('pausa aberta conta até agora', () => {
    const resultado = duracaoEfetiva(
      atendimento({
        pausas: [{ pausadoEm: h('10:20'), retomadoEm: null }] as AtendimentoCompleto['pausas'],
      }),
      h('10:50'),
    );

    expect(resultado).toBe(20);
  });
});
