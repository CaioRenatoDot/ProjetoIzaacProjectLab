import { describe, expect, it } from 'vitest';

import { AptidaoAlocacaoService } from './aptidao-alocacao.service';

const service = new AptidaoAlocacaoService();
const estudante: NonNullable<Parameters<typeof service.estudante>[0]> = {
  id: 'e',
  nome: 'Estudante fictício',
  nivelFormacao: '7º período',
  ativo: true,
  especialidadeId: 'esp',
  especialidade: { unidadeId: 'u', nome: 'Especialidade' },
  disponibilidades: [{ estudanteId: 'e', diaSemana: 'SEGUNDA', turno: 'MANHA' }],
  _count: { alocacoes: 0 },
};
const supervisor: NonNullable<Parameters<typeof service.supervisor>[0]> = {
  id: 's',
  nome: 'Supervisor fictício',
  ativo: true,
  limiteEstudantesSimultaneos: null,
  especialidades: [{ especialidadeId: 'esp' }],
  disponibilidades: [{ supervisorId: 's', diaSemana: 'SEGUNDA', turno: 'MANHA' }],
  _count: { alocacoes: 2 },
};
const sala: NonNullable<Parameters<typeof service.sala>[0]> = {
  id: 'sala',
  identificacao: 'Sala fictícia',
  ativo: true,
  unidadeId: 'u',
  situacao: 'DISPONIVEL',
  recursos: [{ recursoId: 'maca', recurso: { nome: 'Maca' } }],
  _count: { alocacoes: 0 },
};

describe('aptidão compartilhada por sugestão e confirmação (#22)', () => {
  it('RN-05 e RN-06 estudante compatível e livre é apto; inativo ou de outra unidade é recusado', () => {
    expect(service.estudante(estudante, 'u', 'esp')).toBeNull();
    for (const e of [
      null,
      { ...estudante, ativo: false },
      { ...estudante, especialidade: { nome: 'Outra', unidadeId: 'outra' } },
    ])
      expect(service.estudante(e, 'u', 'esp')?.status).toBe(422);
  });
  it.each([
    [{ especialidadeId: 'outra' }, 'ESPECIALIDADE_INCOMPATIVEL'],
    [{ disponibilidades: [] }, 'FORA_DO_TURNO'],
    [{ _count: { alocacoes: 1 } }, 'ATENDIMENTO_ATIVO'],
  ])('RN-05 e RN-06 explicam a inaptidão %s', (mudanca, motivo) => {
    expect(service.estudante({ ...estudante, ...mudanca }, 'u', 'esp')?.motivo).toBe(motivo);
  });
  it('RN-07 supervisor deve estar ativo, habilitado e no turno', () => {
    expect(service.supervisor(supervisor, 'esp', 3)).toBeNull();
    expect(service.supervisor({ ...supervisor, especialidades: [] }, 'esp', 3)?.status).toBe(422);
    expect(service.supervisor({ ...supervisor, ativo: false }, 'esp', 3)?.status).toBe(422);
    expect(service.supervisor({ ...supervisor, disponibilidades: [] }, 'esp', 3)?.motivo).toBe(
      'FORA_DO_TURNO',
    );
  });
  it('RN-08 usa o limite vigente e respeita a sobreposição do limite individual', () => {
    expect(service.supervisor(supervisor, 'esp', 2)?.motivo).toBe('LIMITE_SUPERVISAO_ATINGIDO');
    expect(
      service.supervisor({ ...supervisor, limiteEstudantesSimultaneos: 4 }, 'esp', 2),
    ).toBeNull();
    expect(
      service.supervisor({ ...supervisor, limiteEstudantesSimultaneos: 1 }, 'esp', 5)?.status,
    ).toBe(409);
  });
  it('RN-09 confere unidade, recursos, manutenção e ocupação da sala', () => {
    const exigidos = [{ recursoId: 'maca' }];
    expect(service.sala(sala, 'u', exigidos)).toBeNull();
    expect(service.sala(sala, 'outra', exigidos)?.status).toBe(422);
    expect(service.sala({ ...sala, recursos: [] }, 'u', exigidos)?.motivo).toBe(
      'RECURSO_INDISPONIVEL_NA_SALA',
    );
    expect(service.sala({ ...sala, situacao: 'EM_MANUTENCAO' }, 'u', exigidos)?.status).toBe(409);
    expect(service.sala({ ...sala, _count: { alocacoes: 1 } }, 'u', exigidos)?.motivo).toBe(
      'ATENDIMENTO_ATIVO',
    );
  });
});
