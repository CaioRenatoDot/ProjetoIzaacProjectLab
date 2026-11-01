import { describe, expect, it } from 'vitest';

import { EstudanteEntrada, PacienteEntrada, SupervisorEntrada } from './index';

const ID = '0190a000-0000-7000-8000-000000000001';

describe('cadastros de pessoas', () => {
  it('PacienteEntrada guarda só os dígitos do documento', () => {
    const paciente = PacienteEntrada.parse({
      nomeCompleto: 'Paciente Ficticio',
      documento: '123.456.789-00',
      dataNascimento: '1990-05-01',
      vinculo: 'EXTERNO',
    });

    expect(paciente.documento).toBe('12345678900');
  });

  it('PacienteEntrada recusa nascimento no futuro e documento sem números', () => {
    const base = { nomeCompleto: 'X', vinculo: 'EXTERNO', dataNascimento: '1990-01-01' };

    expect(PacienteEntrada.safeParse({ ...base, documento: 'abc' }).success).toBe(false);
    expect(
      PacienteEntrada.safeParse({ ...base, documento: '1', dataNascimento: '2999-01-01' }).success,
    ).toBe(false);
  });

  it('EstudanteEntrada exige habilitações, procedimentos e disponibilidade (W-04)', () => {
    const base = { nome: 'Estudante', especialidadeId: ID, nivelFormacao: '5º período' };

    expect(EstudanteEntrada.safeParse(base).success).toBe(false);
    expect(
      EstudanteEntrada.safeParse({
        ...base,
        habilitacoesIds: [ID],
        procedimentosIds: [ID],
        disponibilidade: [
          { diaSemana: 1, turno: 'MANHA' },
          { diaSemana: 1, turno: 'MANHA' },
        ],
      }).data?.disponibilidade,
    ).toEqual([{ diaSemana: 1, turno: 'MANHA' }]);
  });

  it('SupervisorEntrada exige limite positivo e ao menos uma especialidade (RN-08)', () => {
    expect(
      SupervisorEntrada.safeParse({
        nome: 'Supervisor',
        especialidadesIds: [ID],
        limiteEstudantesSimultaneos: 0,
      }).success,
    ).toBe(false);
    expect(
      SupervisorEntrada.safeParse({
        nome: 'Supervisor',
        especialidadesIds: [],
        limiteEstudantesSimultaneos: 3,
      }).success,
    ).toBe(false);
  });
});
