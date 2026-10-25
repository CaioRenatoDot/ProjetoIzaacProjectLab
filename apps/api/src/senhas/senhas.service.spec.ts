import { type ParametrosVigentes } from '@filas/contracts';
import { describe, expect, it, vi } from 'vitest';

import { type EventosDominio } from '../common/eventos/eventos-dominio';
import { ErroDominio } from '../common/errors/erro-dominio';
import { type ParametrosService } from '../parametros/parametros.service';
import { type TriagemService } from '../triagem/triagem.service';
import { type SenhaCompleta, type SenhasRepository } from './senhas.repository';
import { numeroDaSenha, SenhasService } from './senhas.service';

const PARAMETROS: ParametrosVigentes = {
  toleranciaMinutos: 5,
  slaMinutos: 25,
  reincidenciasRestricao: 3,
  janelaReincidenciaDias: 90,
  limiteEstudantesSupervisor: 3,
  justificativaMinCaracteres: 20,
};

const senha = (dados: Partial<SenhaCompleta> = {}): SenhaCompleta => ({
  id: 's1',
  numero: 'F001',
  filaId: 'f1',
  triagemId: 't1',
  pacienteId: 'p1',
  prioridade: 'NORMAL',
  tipoAtendimento: 'PRIMEIRA_CONSULTA',
  status: 'AGUARDANDO',
  temAgendamentoPrevio: false,
  chegadaEm: new Date(),
  chamadaEm: null,
  toleranciaAte: null,
  iniciadaEm: null,
  encerradaEm: null,
  senhaOrigemId: null,
  versao: 1,
  criadoEm: new Date(),
  paciente: { nomeCompleto: 'Maria Aparecida da Silva' },
  fila: {
    unidadeId: 'un1',
    especialidadeId: 'e1',
    slaMinutos: null,
    bloqueada: false,
    especialidade: { nome: 'Fisioterapia' },
  },
  ...dados,
});

function montar(atual: SenhaCompleta) {
  const repositorio = {
    transacao: vi.fn((trabalho: (tx: unknown) => Promise<unknown>) => trabalho({})),
    buscar: vi.fn().mockResolvedValue(atual),
    reclassificar: vi.fn().mockResolvedValue(true),
    registrarReclassificacao: vi.fn().mockResolvedValue(undefined),
    posicao: vi.fn().mockResolvedValue(1),
  };
  const eventos = { emitir: vi.fn() };
  const servico = new SenhasService(
    repositorio as unknown as SenhasRepository,
    { vigentes: vi.fn().mockResolvedValue(PARAMETROS) } as unknown as ParametrosService,
    {} as TriagemService,
    eventos as unknown as EventosDominio,
  );
  return { servico, repositorio, eventos };
}

const codigoDe = async (promessa: Promise<unknown>) =>
  ((await promessa.catch((e: unknown) => e)) as ErroDominio).codigo;

const justificativa = 'Piora do quadro relatada na recepcao';

describe('numeroDaSenha', () => {
  it.each([
    ['F', 1, 'F001'],
    ['P', 14, 'P014'],
    ['N', 999, 'N999'],
    ['O', 1000, 'O1000'],
  ])('%s com sequência %i vira %s', (letra, sequencia, numero) => {
    expect(numeroDaSenha(letra, sequencia)).toBe(numero);
  });
});

describe('SenhasService.reclassificar', () => {
  it('RN-01 justificativa abaixo do mínimo do parâmetro volta JUSTIFICATIVA_OBRIGATORIA', async () => {
    const { servico, repositorio } = montar(senha());

    const erro = (await servico
      .reclassificar(
        's1',
        { prioridade: 'URGENTE', justificativa: 'curta', versao: 1 },
        'u1',
        'un1',
      )
      .catch((e: unknown) => e)) as ErroDominio;

    expect(erro.codigo).toBe('JUSTIFICATIVA_OBRIGATORIA');
    expect(erro.status).toBe(422);
    expect(erro.extras).toMatchObject({ minimo: 20, campos: [{ campo: 'justificativa' }] });
    expect(repositorio.reclassificar).not.toHaveBeenCalled();
  });

  it('RN-01 grava a mudança e o histórico com a justificativa e emite o evento', async () => {
    const { servico, repositorio, eventos } = montar(senha());

    await servico.reclassificar(
      's1',
      { prioridade: 'URGENTE', justificativa, versao: 1 },
      'u1',
      'un1',
    );

    expect(repositorio.reclassificar).toHaveBeenCalledWith({}, 's1', 1, 'URGENTE');
    expect(repositorio.registrarReclassificacao).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ dePrioridade: 'NORMAL', paraPrioridade: 'URGENTE', justificativa }),
    );
    expect(eventos.emitir).toHaveBeenCalledWith(
      'senha.reclassificada',
      expect.objectContaining({ senhaId: 's1' }),
    );
  });

  it('versão diferente da atual volta VERSAO_DESATUALIZADA com a senha atual', async () => {
    const { servico } = montar(senha({ versao: 3 }));

    const erro = (await servico
      .reclassificar('s1', { prioridade: 'URGENTE', justificativa, versao: 2 }, 'u1', 'un1')
      .catch((e: unknown) => e)) as ErroDominio;

    expect(erro.codigo).toBe('VERSAO_DESATUALIZADA');
    expect(erro.extras).toMatchObject({ atual: { id: 's1', versao: 3 } });
  });

  it('corrida perdida no UPDATE também volta VERSAO_DESATUALIZADA', async () => {
    const { servico, repositorio } = montar(senha());
    repositorio.reclassificar.mockResolvedValue(false);

    expect(
      await codigoDe(
        servico.reclassificar(
          's1',
          { prioridade: 'URGENTE', justificativa, versao: 1 },
          'u1',
          'un1',
        ),
      ),
    ).toBe('VERSAO_DESATUALIZADA');
    expect(repositorio.registrarReclassificacao).not.toHaveBeenCalled();
  });

  it.each(['EM_ATENDIMENTO', 'ENCERRADO', 'AUSENTE'] as const)(
    'senha em %s não é reclassificada (TRANSICAO_INVALIDA)',
    async (status) => {
      const { servico } = montar(senha({ status }));

      expect(
        await codigoDe(
          servico.reclassificar(
            's1',
            { prioridade: 'URGENTE', justificativa, versao: 1 },
            'u1',
            'un1',
          ),
        ),
      ).toBe('TRANSICAO_INVALIDA');
    },
  );

  it('prioridade igual à atual é recusada', async () => {
    const { servico } = montar(senha());

    expect(
      await codigoDe(
        servico.reclassificar(
          's1',
          { prioridade: 'NORMAL', justificativa, versao: 1 },
          'u1',
          'un1',
        ),
      ),
    ).toBe('VALIDACAO');
  });
});
