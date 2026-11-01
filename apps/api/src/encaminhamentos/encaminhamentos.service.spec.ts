import { type EncaminhamentoEntrada } from '@filas/contracts';
import { describe, expect, it, vi } from 'vitest';

import { type AuditoriaService } from '../common/auditoria/auditoria.service';
import { type EventosDominio } from '../common/eventos/eventos-dominio';
import { type SenhaProjecao } from '../senhas/senha-projecao.service';
import { type SenhasRepository, type Transacao } from '../senhas/senhas.repository';
import { type SenhasService } from '../senhas/senhas.service';
import { EncaminhamentosService } from './encaminhamentos.service';

const usuario = { id: 'autor', unidadeId: 'unidade', perfilNome: 'Perfil fictício' };
const entrada: EncaminhamentoEntrada = { tipo: 'INTERNO', especialidadeDestinoId: 'destino' };
function cenario() {
  const origem = {
    id: 'origem',
    desfecho: 'ENCAMINHAMENTO_INTERNO',
    senha: {
      id: 'senha',
      status: 'ENCERRADO',
      prioridade: 'PREFERENCIAL',
      tipoAtendimento: 'RETORNO',
      triagemId: 'triagem',
      pacienteId: 'paciente',
      triagem: { enquadramentoLegal: 'IDOSO' },
    },
  };
  const repository = {
    origem: vi.fn().mockResolvedValue(origem),
    existente: vi.fn().mockResolvedValue(null),
    destino: vi.fn().mockResolvedValue({ id: 'destino', ativo: true }),
    criar: vi.fn(),
  };
  const tx = {} as Transacao;
  const senhas = { transacao: async <T>(fn: (tx: Transacao) => Promise<T>) => fn(tx) };
  const emissao = {
    emitirNaFila: vi.fn().mockRejectedValue(new Error('interrompida após avaliar a prioridade')),
  };
  const eventos = { emitir: vi.fn() };
  const service = new EncaminhamentosService(
    repository,
    senhas as SenhasRepository,
    emissao as unknown as SenhasService,
    {} as SenhaProjecao,
    {} as AuditoriaService,
    eventos as unknown as EventosDominio,
  );
  return { origem, repository, service, emissao, tx };
}

describe('encaminhamento (UC-14/UC-15, decisões da #26)', () => {
  it.each(['PENDENTE_VALIDACAO', 'EM_ATENDIMENTO'])(
    'RN-11 e UC-14: estado %s não permite encaminhar',
    async (status) => {
      const c = cenario();
      c.origem.senha.status = status;
      await expect(c.service.registrar('origem', entrada, { usuario })).rejects.toMatchObject({
        codigo: 'TRANSICAO_INVALIDA',
        status: 409,
      });
      expect(c.emissao.emitirNaFila).not.toHaveBeenCalled();
      expect(c.repository.criar).not.toHaveBeenCalled();
    },
  );
  it('UC-15 recusa tipo diferente do desfecho e repetições', async () => {
    const c = cenario();
    const externo: EncaminhamentoEntrada = {
      tipo: 'EXTERNO',
      instituicaoDestino: 'Serviço',
      motivo: 'Motivo',
    };
    await expect(c.service.registrar('origem', externo, { usuario })).rejects.toMatchObject({
      codigo: 'TRANSICAO_INVALIDA',
    });
    c.repository.existente.mockResolvedValue({ id: 'existente' });
    await expect(c.service.registrar('origem', entrada, { usuario })).rejects.toMatchObject({
      codigo: 'DUPLICIDADE',
    });
  });
  it.each([null, { id: 'destino', ativo: false }])(
    'UC-14 destino indisponível não emite senha',
    async (destino) => {
      const c = cenario();
      c.repository.destino.mockResolvedValue(destino);
      await expect(c.service.registrar('origem', entrada, { usuario })).rejects.toMatchObject({
        codigo: 'ESPECIALIDADE_INATIVA',
        status: 409,
      });
      expect(c.emissao.emitirNaFila).not.toHaveBeenCalled();
    },
  );
  it('RN-03 sugestão urgente exige motivo também no service', async () => {
    const c = cenario();
    await expect(
      c.service.registrar('origem', { ...entrada, prioridadeSugerida: 'URGENTE' }, { usuario }),
    ).rejects.toMatchObject({ codigo: 'VALIDACAO', status: 422 });
  });
  it('RN-02 preserva prioridade legal, triagem, paciente e tipo de atendimento', async () => {
    const c = cenario();
    await expect(
      c.service.registrar('origem', { ...entrada, prioridadeSugerida: 'NORMAL' }, { usuario }),
    ).rejects.toThrow('interrompida');
    expect(c.emissao.emitirNaFila).toHaveBeenCalledWith(c.tx, {
      unidadeId: 'unidade',
      especialidadeId: 'destino',
      triagemId: 'triagem',
      pacienteId: 'paciente',
      senhaOrigemId: 'senha',
      tipoAtendimento: 'RETORNO',
      prioridade: 'PREFERENCIAL',
      temAgendamentoPrevio: false,
    });
  });
});
