import { type TriagemEntrada } from '@filas/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ErroValidacao } from '../common/errors/erro-dominio';
import { type NovaTriagem, type TriagemRepository } from './triagem.repository';
import { TriagemService } from './triagem.service';

const entrada: TriagemEntrada = {
  pacienteId: 'p1',
  especialidadeDestinoId: 'e1',
  tipoAtendimento: 'PRIMEIRA_CONSULTA',
  prioridade: 'NORMAL',
  motivo: 'Motivo ficticio',
};

function montar({ paciente = true, especialidade = true } = {}) {
  const repositorio = {
    pacienteAtivo: vi.fn().mockResolvedValue(paciente ? { id: 'p1' } : null),
    especialidadeComFila: vi.fn().mockResolvedValue(especialidade ? { id: 'e1' } : null),
    criar: vi.fn((dados: NovaTriagem) =>
      Promise.resolve({
        ...dados,
        id: 't1',
        concluidaEm: new Date('2026-10-25T12:00:00Z'),
        criadoEm: new Date('2026-10-25T12:00:00Z'),
        paciente: { nomeCompleto: 'Maria Aparecida da Silva' },
        especialidadeDestino: { nome: 'Fisioterapia' },
        _count: { senhas: 0 },
      }),
    ),
  };
  const servico = new TriagemService(repositorio as unknown as TriagemRepository);
  return { servico, repositorio };
}

const camposDoErro = async (promessa: Promise<unknown>) => {
  const erro = await promessa.catch((e: unknown) => e);
  expect(erro).toBeInstanceOf(ErroValidacao);
  return ((erro as ErroValidacao).extras?.campos as { campo: string }[]).map((c) => c.campo);
};

describe('TriagemService', () => {
  it('RN-02 enquadramento legal com prioridade NORMAL grava PREFERENCIAL', async () => {
    const { servico, repositorio } = montar();

    const triagem = await servico.registrar(
      { ...entrada, enquadramentoLegal: 'IDOSO' },
      'u1',
      'un1',
    );

    expect(triagem.prioridade).toBe('PREFERENCIAL');
    expect(repositorio.criar).toHaveBeenCalledWith(
      expect.objectContaining({ prioridade: 'PREFERENCIAL', enquadramentoLegal: 'IDOSO' }),
    );
  });

  it('RN-02 RN-03 urgência com enquadramento continua URGENTE', async () => {
    const { servico } = montar();

    const triagem = await servico.registrar(
      {
        ...entrada,
        prioridade: 'URGENTE',
        enquadramentoLegal: 'GESTANTE',
        justificativaClinica: 'Sangramento',
      },
      'u1',
      'un1',
    );

    expect(triagem.prioridade).toBe('URGENTE');
  });

  it('RN-03 urgência sem justificativa clínica aponta o campo e não grava', async () => {
    const { servico, repositorio } = montar();

    expect(
      await camposDoErro(
        servico.registrar(
          { ...entrada, prioridade: 'URGENTE', justificativaClinica: ' ' },
          'u1',
          'un1',
        ),
      ),
    ).toEqual(['justificativaClinica']);
    expect(repositorio.criar).not.toHaveBeenCalled();
  });

  it('recusa paciente inativo e especialidade sem fila, apontando os dois campos', async () => {
    const { servico } = montar({ paciente: false, especialidade: false });

    expect(await camposDoErro(servico.registrar(entrada, 'u1', 'un1'))).toEqual([
      'pacienteId',
      'especialidadeDestinoId',
    ]);
  });

  it('o profissional é o usuário autenticado e a lista sai só com as iniciais', async () => {
    const { servico, repositorio } = montar();

    const triagem = await servico.registrar(entrada, 'u1', 'un1');

    expect(repositorio.criar).toHaveBeenCalledWith(
      expect.objectContaining({ profissionalId: 'u1' }),
    );
    expect(triagem).toMatchObject({
      pacienteIniciais: 'M. A. S.',
      especialidadeId: 'e1',
      senhaEmitida: false,
    });
  });
});
