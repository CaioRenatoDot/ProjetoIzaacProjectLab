import { Injectable } from '@nestjs/common';
import {
  type AtendimentoDetalhe,
  type AtendimentoResumo,
  type EncerramentoResposta,
  type EncerrarEntrada,
  type ListarAtendimentosQuery,
  type PausarEntrada,
  type RespostaPaginada,
  type ValidarEntrada,
} from '@filas/contracts';
import { type Prisma, type StatusSenha } from '@prisma/client';

import { iniciais } from '../cadastros/pessoas.util';
import { ErroDominio } from '../common/errors/erro-dominio';
import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { Relogio } from '../common/relogio';
import { MaquinaSenha, type MudancaStatus } from '../senhas/maquina/maquina-senha.service';
import { SenhaProjecao } from '../senhas/senha-projecao.service';
import { SenhasRepository, type Transacao } from '../senhas/senhas.repository';
import { TriagemService } from '../triagem/triagem.service';
import { type AtendimentoCompleto, AtendimentosRepository } from './atendimentos.repository';

/** Tempo efetivo em minutos: do início ao encerramento (ou agora), menos as pausas (RF-10). */
export function duracaoEfetiva(atendimento: AtendimentoCompleto, agora: Date): number {
  const fim = (atendimento.encerradoEm ?? agora).getTime();
  const pausado = atendimento.pausas.reduce(
    (total, pausa) =>
      total + (Math.min(pausa.retomadoEm?.getTime() ?? fim, fim) - pausa.pausadoEm.getTime()),
    0,
  );
  return Math.max(0, Math.floor((fim - atendimento.iniciadoEm.getTime() - pausado) / 60_000));
}

const naoEncontrado = () =>
  new ErroDominio(
    'NAO_ENCONTRADO',
    404,
    'Atendimento não encontrado',
    'O registro não existe ou foi removido.',
  );

const transicaoInvalida = (detalhe: string) =>
  new ErroDominio('TRANSICAO_INVALIDA', 409, 'Ação indisponível para este atendimento', detalhe);

const indisponivel = (detalhe: string) =>
  new ErroDominio(
    'RECURSO_INDISPONIVEL',
    409,
    'Recurso indisponível',
    `${detalhe} Refaça a alocação antes de continuar.`,
  );

/**
 * Ciclo do atendimento (UC-11 a UC-13, RF-07, RN-11). Todo status passa pela máquina de
 * estados; a `versao` é a da senha.
 */
@Injectable()
export class AtendimentosService {
  constructor(
    private readonly repositorio: AtendimentosRepository,
    private readonly senhas: SenhasRepository,
    private readonly projecao: SenhaProjecao,
    private readonly maquina: MaquinaSenha,
    private readonly triagens: TriagemService,
    private readonly relogio: Relogio,
  ) {}

  async listar(
    query: ListarAtendimentosQuery,
    unidadeId: string,
  ): Promise<RespostaPaginada<AtendimentoResumo>> {
    const where: Prisma.AtendimentoWhereInput = {
      senha: {
        fila: { unidadeId },
        ...(query.status?.length ? { status: { in: query.status } } : {}),
      },
      ...(query.estudanteId || query.supervisorId
        ? {
            alocacao: {
              ...(query.estudanteId ? { estudanteId: query.estudanteId } : {}),
              ...(query.supervisorId ? { supervisorId: query.supervisorId } : {}),
            },
          }
        : {}),
    };
    const [dados, total] = await this.repositorio.listar(where, deslocamento(query));
    const agora = this.relogio.agora();
    return montarRespostaPaginada(
      dados.map((atendimento) => this.paraResumo(atendimento, agora)),
      total,
      query,
    );
  }

  async consultar(id: string, unidadeId: string): Promise<AtendimentoDetalhe> {
    const atendimento = await this.repositorio.buscar(id, unidadeId);
    if (!atendimento) throw naoEncontrado();
    return {
      ...this.paraResumo(atendimento, this.relogio.agora()),
      pacienteNome: atendimento.senha.paciente.nomeCompleto,
      triagem: await this.triagens.consultar(atendimento.senha.triagemId, unidadeId),
      observacoes: atendimento.observacoes,
      parecerSupervisor: atendimento.parecerSupervisor,
      validadoPor: atendimento.validador?.nome ?? null,
      validadoEm: atendimento.validadoEm?.toISOString() ?? null,
      pausas: atendimento.pausas.map((pausa) => ({
        motivo: pausa.motivo,
        pausadoEm: pausa.pausadoEm.toISOString(),
        retomadoEm: pausa.retomadoEm?.toISOString() ?? null,
      })),
    };
  }

  /** UC-11: começa com os recursos alocados ainda disponíveis (RN-07, RN-09). */
  async iniciar(senhaId: string, versao: number, unidadeId: string): Promise<AtendimentoResumo> {
    return this.executar(unidadeId, async (tx, agora) => {
      const senha = await this.repositorio.senhaParaIniciar(tx, senhaId, unidadeId);
      if (!senha) {
        throw new ErroDominio(
          'NAO_ENCONTRADO',
          404,
          'Senha não encontrada',
          'O registro não existe ou foi removido.',
        );
      }
      if (senha.versao !== versao) {
        throw await this.projecao.versaoDesatualizada(senhaId, unidadeId, tx);
      }
      const alocacao = senha.alocacoes[0];
      if (!alocacao)
        throw transicaoInvalida('Aloque estudante e sala antes de iniciar o atendimento.');
      const especialidade = senha.fila.especialidade;
      if (!alocacao.estudante.ativo) throw indisponivel('O estudante alocado foi inativado.');
      if (!alocacao.sala.ativo || alocacao.sala.situacao !== 'DISPONIVEL') {
        throw indisponivel('A sala alocada não está mais disponível.');
      }
      if (
        especialidade.exigeSupervisaoDocente &&
        (!alocacao.supervisorId || !alocacao.supervisor?.ativo)
      ) {
        throw indisponivel('A especialidade exige supervisor disponível (RN-07).');
      }
      const mudanca = await this.maquina.transicionar(tx, {
        senhaId,
        unidadeId,
        versao,
        para: 'EM_ATENDIMENTO',
        agora,
      });
      const { id } = await this.repositorio.criar(tx, {
        senhaId,
        alocacaoId: alocacao.id,
        // RN-11: copiado agora; mudar o cadastro depois não altera o atendimento em curso.
        validacaoExigida: especialidade.exigeValidacaoEncerramento,
        iniciadoEm: agora,
      });
      return { id, mudanca };
    });
  }

  /** UC-12: uma linha em `pausa_atendimento` por pausa. */
  async pausar(
    id: string,
    entrada: PausarEntrada,
    usuarioId: string,
    unidadeId: string,
  ): Promise<AtendimentoResumo> {
    return this.executar(unidadeId, async (tx, agora) => {
      const atendimento = await this.buscar(tx, id, unidadeId);
      const mudanca = await this.transicionar(
        tx,
        atendimento,
        entrada.versao,
        'PAUSADO',
        unidadeId,
        agora,
      );
      await this.repositorio.abrirPausa(tx, {
        atendimentoId: id,
        motivo: entrada.motivo ?? null,
        pausadoPor: usuarioId,
        pausadoEm: agora,
      });
      await this.repositorio.atualizar(tx, id, {});
      return { id, mudanca };
    });
  }

  async retomar(id: string, versao: number, unidadeId: string): Promise<AtendimentoResumo> {
    return this.executar(unidadeId, async (tx, agora) => {
      const atendimento = await this.buscar(tx, id, unidadeId);
      const recursos = await this.repositorio.recursosDaAlocacao(tx, atendimento.alocacaoId);
      if (atendimento.senha.status === 'PAUSADO') {
        if (!recursos.estudante.ativo) throw indisponivel('O estudante alocado foi inativado.');
        if (!recursos.sala.ativo || recursos.sala.situacao !== 'DISPONIVEL') {
          throw indisponivel('A sala alocada não está mais disponível.');
        }
      }
      const mudanca = await this.transicionar(
        tx,
        atendimento,
        versao,
        'EM_ATENDIMENTO',
        unidadeId,
        agora,
      );
      await this.repositorio.fecharPausa(tx, id, agora);
      await this.repositorio.atualizar(tx, id, {});
      return { id, mudanca };
    });
  }

  /** UC-13, RN-11: com validação exigida vai a PENDENTE_VALIDACAO; libera a alocação. */
  async encerrar(
    id: string,
    entrada: EncerrarEntrada,
    unidadeId: string,
  ): Promise<EncerramentoResposta> {
    const desfecho = entrada.desfecho;
    if (!desfecho) {
      throw new ErroDominio(
        'DESFECHO_OBRIGATORIO',
        422,
        'Desfecho obrigatório',
        'Informe o desfecho para encerrar o atendimento.',
        {
          campos: [{ campo: 'desfecho', mensagem: 'Escolha o desfecho do atendimento.' }],
        },
      );
    }
    const atendimento = await this.executar(unidadeId, async (tx, agora) => {
      const atual = await this.buscar(tx, id, unidadeId);
      const observacoes = entrada.observacoes ?? null;
      if (atual.senha.status === 'PENDENTE_VALIDACAO') {
        // Depois de uma recusa, o estudante corrige e reenvia; o status não muda.
        if (!atual.parecerSupervisor) {
          throw transicaoInvalida('O encerramento aguarda a validação do supervisor.');
        }
        await this.conferirEIncrementarVersao(tx, atual, entrada.versao, unidadeId);
        await this.repositorio.registrarDesfecho(tx, id, desfecho, observacoes, agora);
        return { id, mudanca: null };
      }
      if (atual.senha.status !== 'EM_ATENDIMENTO') {
        throw transicaoInvalida(
          atual.senha.status === 'PAUSADO'
            ? 'Retome o atendimento antes de encerrar.'
            : 'Só é possível encerrar atendimento em curso.',
        );
      }
      const mudanca = await this.transicionar(
        tx,
        atual,
        entrada.versao,
        atual.validacaoExigida ? 'PENDENTE_VALIDACAO' : 'ENCERRADO',
        unidadeId,
        agora,
      );
      await this.repositorio.registrarDesfecho(tx, id, desfecho, observacoes, agora);
      await this.repositorio.liberarAlocacao(tx, atual.alocacaoId, agora);
      return { id, mudanca };
    });
    return {
      atendimento,
      exigeValidacao: atendimento.exigeValidacao,
      exigeEncaminhamento:
        desfecho === 'ENCAMINHAMENTO_INTERNO' || desfecho === 'ENCAMINHAMENTO_EXTERNO',
    };
  }

  /** RN-11: aprova (ENCERRADO) ou recusa com parecer (continua PENDENTE_VALIDACAO). */
  async validar(
    id: string,
    entrada: ValidarEntrada,
    usuarioId: string,
    unidadeId: string,
  ): Promise<AtendimentoResumo> {
    return this.executar(unidadeId, async (tx, agora) => {
      const atendimento = await this.buscar(tx, id, unidadeId);
      if (atendimento.senha.status !== 'PENDENTE_VALIDACAO') {
        throw transicaoInvalida('O atendimento não está aguardando validação.');
      }
      if (!entrada.aprovado) {
        await this.conferirEIncrementarVersao(tx, atendimento, entrada.versao, unidadeId);
        await this.repositorio.atualizar(tx, id, { parecerSupervisor: entrada.parecer ?? null });
        return { id, mudanca: null };
      }
      const mudanca = await this.transicionar(
        tx,
        atendimento,
        entrada.versao,
        'ENCERRADO',
        unidadeId,
        agora,
      );
      await this.repositorio.atualizar(tx, id, {
        validadoPor: usuarioId,
        validadoEm: agora,
        ...(entrada.parecer ? { parecerSupervisor: entrada.parecer } : {}),
      });
      return { id, mudanca };
    });
  }

  /** Transação, publicação do evento depois do commit e resposta com o estado gravado. */
  private async executar(
    unidadeId: string,
    trabalho: (
      tx: Transacao,
      agora: Date,
    ) => Promise<{ id: string; mudanca: MudancaStatus | null }>,
  ): Promise<AtendimentoResumo> {
    const agora = this.relogio.agora();
    const { id, mudanca } = await this.senhas.transacao((tx) => trabalho(tx, agora));
    if (mudanca) this.maquina.publicar(mudanca);
    const atendimento = (await this.repositorio.buscar(id, unidadeId))!;
    return this.paraResumo(atendimento, this.relogio.agora());
  }

  private async buscar(tx: Transacao, id: string, unidadeId: string): Promise<AtendimentoCompleto> {
    const atendimento = await this.repositorio.buscar(id, unidadeId, tx);
    if (!atendimento) throw naoEncontrado();
    return atendimento;
  }

  private transicionar(
    tx: Transacao,
    atendimento: AtendimentoCompleto,
    versao: number,
    para: StatusSenha,
    unidadeId: string,
    agora: Date,
  ): Promise<MudancaStatus> {
    return this.maquina.transicionar(tx, {
      senhaId: atendimento.senhaId,
      unidadeId,
      versao,
      para,
      agora,
    });
  }

  private async conferirEIncrementarVersao(
    tx: Transacao,
    atendimento: AtendimentoCompleto,
    versao: number,
    unidadeId: string,
  ): Promise<void> {
    if (
      atendimento.senha.versao !== versao ||
      !(await this.senhas.incrementarVersao(tx, atendimento.senhaId, versao))
    ) {
      throw await this.projecao.versaoDesatualizada(atendimento.senhaId, unidadeId, tx);
    }
  }

  private paraResumo(atendimento: AtendimentoCompleto, agora: Date): AtendimentoResumo {
    return {
      id: atendimento.id,
      senhaId: atendimento.senhaId,
      numero: atendimento.senha.numero,
      pacienteIniciais: iniciais(atendimento.senha.paciente.nomeCompleto),
      especialidade: atendimento.senha.fila.especialidade.nome,
      estudante: atendimento.alocacao.estudante.nome,
      supervisor: atendimento.alocacao.supervisor?.nome ?? null,
      sala: atendimento.alocacao.sala.identificacao,
      status: atendimento.senha.status,
      iniciadoEm: atendimento.iniciadoEm.toISOString(),
      duracaoMinutos: duracaoEfetiva(atendimento, agora),
      encerradoEm: atendimento.encerradoEm?.toISOString() ?? null,
      desfecho: atendimento.desfecho,
      exigeValidacao: atendimento.validacaoExigida,
      versao: atendimento.senha.versao,
    };
  }
}
