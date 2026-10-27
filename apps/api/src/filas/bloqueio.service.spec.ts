import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type AlocacaoService } from '../alocacao/alocacao.service';
import { type EventosDominio } from '../common/eventos/eventos-dominio';
import { type ParametrosService } from '../parametros/parametros.service';
import { type Transacao } from '../senhas/senhas.repository';
import { type BloqueioRepository } from './bloqueio.repository';
import { BloqueioService } from './bloqueio.service';

function montar({ bloqueada = false, exigeSupervisao = true, disponivel = false } = {}) {
  const tx = {} as Transacao;
  const fila = {
    id: 'fila',
    unidadeId: 'unidade',
    especialidadeId: 'especialidade',
    ativa: true,
    bloqueada,
    especialidade: { nome: 'Fisioterapia', exigeSupervisaoDocente: exigeSupervisao },
  };
  const repositorio = {
    transacao: vi.fn((trabalho: (tx: Transacao) => Promise<unknown>) => trabalho(tx)),
    fila: vi.fn().mockResolvedValue(fila),
    gravar: vi.fn().mockResolvedValue(undefined),
    monitoradas: vi.fn().mockResolvedValue([{ id: 'fila', unidadeId: 'unidade' }]),
  };
  const alocacao = { haSupervisorDisponivel: vi.fn().mockResolvedValue(disponivel) };
  const parametros = { vigentes: vi.fn().mockResolvedValue({ limiteEstudantesSupervisor: 3 }) };
  const agora = new Date('2026-10-27T10:00:00-03:00');
  const relogio = { agora: vi.fn().mockReturnValue(agora) };
  const eventos = { emitir: vi.fn() };
  const service = new BloqueioService(
    repositorio as unknown as BloqueioRepository,
    alocacao as unknown as AlocacaoService,
    parametros as unknown as ParametrosService,
    relogio,
    eventos as unknown as EventosDominio,
  );
  return { service, repositorio, alocacao, parametros, relogio, eventos, fila, tx, agora };
}

describe('bloqueio por supervisão (#19)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('RN-10 bloqueia somente a fila pedida e informa motivo e início', async () => {
    const c = montar();
    await c.service.atualizar('fila', 'unidade');
    expect(c.repositorio.fila).toHaveBeenCalledWith(c.tx, 'fila', 'unidade');
    expect(c.repositorio.gravar).toHaveBeenCalledWith(
      c.tx,
      'fila',
      true,
      expect.any(String),
      c.agora,
    );
    expect(c.eventos.emitir).toHaveBeenCalledWith(
      'fila.bloqueada',
      expect.objectContaining({
        filaId: 'fila',
        especialidade: 'Fisioterapia',
        desde: c.agora.toISOString(),
      }),
    );
  });

  it('RN-07 e RN-10 usa o turno e o limite vigente nas mesmas verificações da alocação', async () => {
    const c = montar();
    await c.service.atualizar('fila', 'unidade');
    expect(c.alocacao.haSupervisorDisponivel).toHaveBeenCalledWith(
      c.tx,
      'especialidade',
      { diaSemana: 'TERCA', turno: 'MANHA' },
      3,
    );
    expect(c.parametros.vigentes).toHaveBeenCalledWith('unidade', 'especialidade', c.tx);
  });

  it('RN-10 desbloqueia quando o supervisor fica disponível', async () => {
    const c = montar({ bloqueada: true, disponivel: true });
    await c.service.atualizar('fila', 'unidade');
    expect(c.repositorio.gravar).toHaveBeenCalledWith(
      c.tx,
      'fila',
      false,
      expect.any(String),
      c.agora,
    );
    expect(c.eventos.emitir).toHaveBeenCalledWith('fila.desbloqueada', {
      filaId: 'fila',
      especialidade: 'Fisioterapia',
      em: c.agora.toISOString(),
    });
  });

  it('RN-10 não bloqueia especialidade sem supervisão e não repete evento nem início do bloqueio', async () => {
    const c = montar({ exigeSupervisao: false });
    await c.service.atualizar('fila', 'unidade');
    expect(c.alocacao.haSupervisorDisponivel).not.toHaveBeenCalled();
    expect(c.repositorio.gravar).not.toHaveBeenCalled();
    const jaBloqueada = montar({ bloqueada: true });
    await jaBloqueada.service.atualizar('fila', 'unidade');
    expect(jaBloqueada.repositorio.gravar).not.toHaveBeenCalled();
    expect(jaBloqueada.eventos.emitir).not.toHaveBeenCalled();
  });

  it('RN-10 rollback ou falha de commit não publica bloqueio', async () => {
    const c = montar();
    c.repositorio.transacao.mockImplementationOnce(async (trabalho) => {
      await trabalho(c.tx);
      throw new Error('Commit recusado');
    });
    await expect(c.service.atualizar('fila', 'unidade')).rejects.toThrow('Commit recusado');
    expect(c.eventos.emitir).not.toHaveBeenCalled();
  });

  it('RN-10 a varredura continua nas outras filas quando uma reavaliação falha', async () => {
    const c = montar();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    c.repositorio.monitoradas.mockResolvedValue([
      { id: 'fila', unidadeId: 'unidade' },
      { id: 'outra', unidadeId: 'unidade' },
    ]);
    const atualizar = vi
      .spyOn(c.service, 'atualizar')
      .mockRejectedValueOnce(new Error('Falha temporária'))
      .mockResolvedValue(undefined);
    await c.service.executar();
    expect(atualizar).toHaveBeenCalledTimes(2);
    expect(atualizar).toHaveBeenLastCalledWith('outra', 'unidade');
  });
});
