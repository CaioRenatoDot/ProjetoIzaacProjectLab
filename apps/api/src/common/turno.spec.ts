import { describe, expect, it } from 'vitest';

import { turnoAtual } from './turno';

describe('turnoAtual (fuso da unidade, -03:00)', () => {
  it.each([
    ['2026-10-26T09:59:00Z', null],
    ['2026-10-26T10:00:00-03:00', { diaSemana: 'SEGUNDA', turno: 'MANHA' }],
    ['2026-10-26T11:59:00-03:00', { diaSemana: 'SEGUNDA', turno: 'MANHA' }],
    ['2026-10-26T12:00:00-03:00', { diaSemana: 'SEGUNDA', turno: 'TARDE' }],
    ['2026-10-26T18:00:00-03:00', { diaSemana: 'SEGUNDA', turno: 'NOITE' }],
    ['2026-10-26T21:59:00-03:00', { diaSemana: 'SEGUNDA', turno: 'NOITE' }],
    ['2026-10-26T22:00:00-03:00', null],
    ['2026-10-26T06:59:00-03:00', null],
    // 00h30 UTC de domingo ainda é sábado, 21h30, no fuso da unidade.
    ['2026-10-25T00:30:00Z', { diaSemana: 'SABADO', turno: 'NOITE' }],
  ] as const)('RN-05 %s', (instante, esperado) => {
    expect(turnoAtual(new Date(instante))).toEqual(esperado);
  });
});
