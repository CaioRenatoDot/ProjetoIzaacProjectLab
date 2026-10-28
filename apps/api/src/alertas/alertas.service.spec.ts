import { describe, expect, it, vi } from 'vitest';

import { type AuditoriaService } from '../common/auditoria/auditoria.service';
import { type EventosDominio } from '../common/eventos/eventos-dominio';
import { type ParametrosService } from '../parametros/parametros.service';
import { type AlertasRepository, type TransacaoAlerta } from './alertas.repository';
import { AlertasService } from './alertas.service';

const id = '01900000-0000-7000-8000-000000000001';
const agora = new Date('2026-10-28T13:00:00Z');
const usuario = { id, unidadeId: id, perfilNome: 'Gestão fictícia' };
function cenario() {
  const fila = {
    id,
    unidadeId: id,
    especialidadeId: id,
    ativa: true,
    bloqueada: false,
    slaMinutos: null as number | null,
  };
  const registro = {
    id,
    tipo: 'SLA_EXCEDIDO',
    status: 'ATIVO',
    filaId: id,
    tempoEsperaMinutos: 32,
    limiteMinutos: 25,
    senhasAfetadas: 1,
    disparadoEm: agora,
    reconhecidoEm: null,
    normalizadoEm: null,
    reconhecedor: null,
    fila: { especialidade: { nome: 'Especialidade fictícia' } },
    escalonamentos: [],
  };
  const tx = {} as TransacaoAlerta;
  let terminou = false;
  const repository = {
    transacao: async <T>(fn: (tx: TransacaoAlerta) => Promise<T>) => {
      const r = await fn(tx);
      terminou = true;
      return r;
    },
    fila: vi.fn().mockResolvedValue(fila),
    espera: vi.fn().mockResolvedValue({
      maisAntiga: new Date(agora.getTime() - 31.1 * 60_000),
      aguardando: 3,
      acima: 1,
    }),
    aberto: vi.fn().mockResolvedValue(null),
    criar: vi.fn().mockResolvedValue(registro),
    normalizar: vi.fn(),
    bloquear: vi.fn().mockResolvedValue(registro),
    reconhecer: vi.fn(),
    escalonar: vi.fn(),
  };
  const parametros = { vigentes: vi.fn().mockResolvedValue({ slaMinutos: 25 }) };
  const auditoria = { registrar: vi.fn().mockResolvedValue(undefined) };
  const eventos = {
    emitir: vi.fn(() => {
      expect(terminou).toBe(true);
    }),
  };
  const service = new AlertasService(
    repository as unknown as AlertasRepository,
    parametros as unknown as ParametrosService,
    auditoria as unknown as AuditoriaService,
    eventos as unknown as EventosDominio,
    { agora: () => agora },
  );
  return { service, repository, fila, registro, parametros, auditoria, eventos, tx };
}

describe('RF-11 e RN-10: regras de alertas', () => {
  it('RF-11 usa parâmetros da especialidade na transação, maior espera e só senhas acima do limite', async () => {
    const c = cenario();
    await c.service.avaliarSla(id);
    expect(c.parametros.vigentes).toHaveBeenCalledWith(id, id, c.tx);
    expect(c.repository.espera).toHaveBeenCalledWith(
      c.tx,
      id,
      new Date(agora.getTime() - 25 * 60_000),
    );
    expect(c.repository.criar).toHaveBeenCalledWith(
      c.tx,
      expect.objectContaining({ tempoEsperaMinutos: 32, senhasAfetadas: 1, limiteMinutos: 25 }),
    );
    expect(c.auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacao: 'CRIAR', usuarioId: null }),
      c.tx,
    );
    expect(c.eventos.emitir).toHaveBeenCalledWith(
      'sla.excedido',
      expect.objectContaining({ unidadeId: id }),
    );
  });
  it('RF-11 SLA da fila sobrepõe os parâmetros; fila inativa não gera alerta', async () => {
    const c = cenario();
    c.fila.slaMinutos = 12;
    await c.service.avaliarSla(id);
    expect(c.parametros.vigentes).not.toHaveBeenCalled();
    expect(c.repository.criar).toHaveBeenCalledWith(
      c.tx,
      expect.objectContaining({ limiteMinutos: 12 }),
    );
    c.fila.ativa = false;
    c.repository.criar.mockClear();
    await c.service.avaliarSla(id);
    expect(c.repository.criar).not.toHaveBeenCalled();
  });
  it('RF-11 exatamente no limite não dispara; alerta aberto preserva seu retrato e reconhecimento', async () => {
    const c = cenario();
    c.repository.espera.mockResolvedValue({ maisAntiga: agora, aguardando: 1, acima: 0 });
    await c.service.avaliarSla(id);
    expect(c.eventos.emitir).not.toHaveBeenCalled();
    c.repository.espera.mockResolvedValue({ maisAntiga: agora, aguardando: 1, acima: 1 });
    c.repository.aberto.mockResolvedValue({ id });
    await c.service.avaliarSla(id);
    expect(c.repository.criar).not.toHaveBeenCalled();
    expect(c.repository.normalizar).not.toHaveBeenCalled();
    expect(c.auditoria.registrar).not.toHaveBeenCalled();
  });
  it('RF-11 normaliza quando não há mais senhas acima do limite e publica após o commit', async () => {
    const c = cenario();
    c.repository.aberto.mockResolvedValue({ id });
    c.repository.espera.mockResolvedValue({ maisAntiga: null, aguardando: 0, acima: 0 });
    await c.service.avaliarSla(id);
    expect(c.repository.normalizar).toHaveBeenCalledWith(c.tx, id, agora);
    expect(c.eventos.emitir).toHaveBeenCalledWith('sla.normalizado', {
      unidadeId: id,
      dados: { alertaId: id, normalizadoEm: agora.toISOString() },
    });
  });
  it('RN-10 deriva o alerta do bloqueio persistido, com tempos nulos, e normaliza no desbloqueio', async () => {
    const c = cenario();
    c.fila.bloqueada = true;
    await c.service.sincronizarBloqueio(id);
    expect(c.repository.criar).toHaveBeenCalledWith(
      c.tx,
      expect.objectContaining({
        tipo: 'FILA_BLOQUEADA',
        tempoEsperaMinutos: null,
        limiteMinutos: null,
        senhasAfetadas: 3,
      }),
    );
    expect(c.parametros.vigentes).not.toHaveBeenCalled();
    c.fila.bloqueada = false;
    c.repository.aberto.mockResolvedValue({ id });
    await c.service.sincronizarBloqueio(id);
    expect(c.repository.normalizar).toHaveBeenCalledWith(c.tx, id, agora);
  });
  it('T-17 reconhecer novamente preserva autor e horário sem nova escrita', async () => {
    const c = cenario();
    c.registro.status = 'RECONHECIDO';
    await c.service.reconhecer(id, { usuario });
    expect(c.repository.reconhecer).not.toHaveBeenCalled();
    expect(c.auditoria.registrar).not.toHaveBeenCalled();
  });
  it('T-17 normalizado recusa as duas ações; inexistente retorna 404 neutro', async () => {
    const c = cenario();
    c.registro.status = 'NORMALIZADO';
    await expect(c.service.reconhecer(id, { usuario })).rejects.toMatchObject({
      codigo: 'TRANSICAO_INVALIDA',
      status: 409,
    });
    await expect(
      c.service.escalonar(id, { acao: 'VAGA_EXTRA' }, { usuario }),
    ).rejects.toMatchObject({ codigo: 'TRANSICAO_INVALIDA', status: 409 });
    c.repository.bloquear.mockResolvedValue(null);
    await expect(c.service.reconhecer(id, { usuario })).rejects.toMatchObject({
      codigo: 'NAO_ENCONTRADO',
      status: 404,
    });
    expect(c.repository.escalonar).not.toHaveBeenCalled();
  });
  it('RNF-05 falha na auditoria não publica evento da transação rejeitada', async () => {
    const c = cenario();
    c.auditoria.registrar.mockRejectedValue(new Error('Falha fictícia'));
    await expect(c.service.avaliarSla(id)).rejects.toThrow('Falha fictícia');
    expect(c.eventos.emitir).not.toHaveBeenCalled();
  });
});
