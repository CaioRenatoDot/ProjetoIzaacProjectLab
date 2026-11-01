import { Injectable } from '@nestjs/common';
import {
  type Chamada,
  type ChamarProximaEntrada,
  type ResultadoChamada,
  type SenhaResumo,
} from '@filas/contracts';

import { ErroDominio } from '../common/errors/erro-dominio';
import { EventosDominio } from '../common/eventos/eventos-dominio';
import { IdempotenciaService } from '../common/idempotencia/idempotencia.service';
import { ParametrosService } from '../parametros/parametros.service';
import { MaquinaSenha } from '../senhas/maquina/maquina-senha.service';
import { SenhaProjecao } from '../senhas/senha-projecao.service';
import { SenhasRepository, type Transacao } from '../senhas/senhas.repository';
import { type ChamadaCompleta, FilasRepository } from './filas.repository';
import { filaNaoEncontrada } from './filas.service';
import { BloqueioService } from './bloqueio.service';

function paraChamada(chamada: ChamadaCompleta): Chamada {
  return {
    id: chamada.id,
    senhaId: chamada.senhaId,
    numero: chamada.senha.numero,
    local: chamada.localExibicao,
    sequencia: chamada.sequencia,
    chamadoEm: chamada.chamadoEm.toISOString(),
    chamadoPor: chamada.usuario.nome,
  };
}

const chamadaNaoEncontrada = () =>
  new ErroDominio(
    'NAO_ENCONTRADO',
    404,
    'Chamada não encontrada',
    'O registro não existe ou foi removido.',
  );

const chamadaEncerrada = () =>
  new ErroDominio(
    'TRANSICAO_INVALIDA',
    409,
    'Chamada não está mais vigente',
    'A senha já não está chamada ou foi chamada de novo. Atualize o quadro.',
  );

/**
 * Chamar a próxima senha (UC-09, RF-05), rechamar e cancelar. A seleção usa
 * `FOR UPDATE SKIP LOCKED` numa única transação (DAS §6.1) e a mudança de status passa pela
 * máquina de estados.
 */
@Injectable()
export class ChamadasService {
  constructor(
    private readonly repositorio: FilasRepository,
    private readonly senhas: SenhasRepository,
    private readonly projecao: SenhaProjecao,
    private readonly maquina: MaquinaSenha,
    private readonly parametros: ParametrosService,
    private readonly idempotencia: IdempotenciaService,
    private readonly eventos: EventosDominio,
    private readonly bloqueio: BloqueioService,
  ) {}

  async chamarProxima(
    filaId: string,
    entrada: ChamarProximaEntrada,
    usuario: { id: string; unidadeId: string },
    chaveIdempotencia: string | undefined,
  ): Promise<ResultadoChamada> {
    await this.bloqueio.atualizar(filaId, usuario.unidadeId);
    return this.idempotencia.executar(
      {
        usuarioId: usuario.id,
        chave: chaveIdempotencia,
        operacao: `POST /filas/${filaId}/chamadas`,
        corpo: entrada,
      },
      async (tx) => {
        const fila = await this.repositorio.bloquearParaChamada(tx, filaId, usuario.unidadeId);
        if (!fila) throw filaNaoEncontrada();
        if (fila.bloqueada) {
          throw new ErroDominio(
            'FILA_BLOQUEADA',
            409,
            'Fila bloqueada',
            `${fila.especialidade.nome} está sem supervisor habilitado disponível. As chamadas seguem suspensas até a regularização.`,
          );
        }
        const proxima = await this.repositorio.proximaBloqueada(tx, filaId);
        if (!proxima) {
          throw new ErroDominio(
            'FILA_VAZIA',
            409,
            'Nenhuma senha aguardando',
            'Não há senha aguardando nesta fila no momento.',
          );
        }
        const furouFilaPorUrgencia =
          proxima.prioridade === 'URGENTE' &&
          (await this.repositorio.haNaoUrgenteAnterior(tx, filaId, proxima.chegada_em));

        const mudanca = await this.maquina.transicionar(tx, {
          senhaId: proxima.id,
          unidadeId: usuario.unidadeId,
          versao: proxima.versao,
          para: 'CHAMADA',
        });
        const chamada = await this.repositorio.criarChamada(tx, {
          senhaId: proxima.id,
          usuarioId: usuario.id,
          localExibicao: entrada.localExibicao ?? fila.nome,
          sequencia: await this.repositorio.proximaSequencia(tx, proxima.id),
        });
        const senha = await this.resumo(tx, proxima.id, usuario.unidadeId);
        const resultado: ResultadoChamada = {
          senha,
          chamada: paraChamada(chamada),
          furouFilaPorUrgencia,
          toleranciaAte: senha.toleranciaAte!,
        };
        return {
          corpo: resultado,
          aposCommit: () => {
            this.maquina.publicar(mudanca);
            this.eventos.emitir('senha.chamada', { senha, chamada: resultado.chamada });
          },
        };
      },
    );
  }

  /** Nova sequência no telão e nova janela de tolerância; o status continua CHAMADA. */
  async rechamar(chamadaId: string, usuario: { id: string; unidadeId: string }): Promise<Chamada> {
    const { chamada, senha } = await this.senhas.transacao(async (tx) => {
      const vigente = await this.chamadaVigente(tx, chamadaId, usuario.unidadeId);
      const fila = await tx.fila.findUniqueOrThrow({
        where: { id: vigente.senha.filaId },
        select: { especialidadeId: true },
      });
      const { toleranciaMinutos } = await this.parametros.vigentes(
        usuario.unidadeId,
        fila.especialidadeId,
        tx,
      );
      const renovou = await this.repositorio.renovarTolerancia(
        tx,
        vigente.senhaId,
        vigente.senha.versao,
        new Date(Date.now() + toleranciaMinutos * 60_000),
      );
      if (!renovou) {
        throw await this.projecao.versaoDesatualizada(vigente.senhaId, usuario.unidadeId, tx);
      }
      const nova = await this.repositorio.criarChamada(tx, {
        senhaId: vigente.senhaId,
        usuarioId: usuario.id,
        localExibicao: vigente.localExibicao,
        sequencia: vigente.sequencia + 1,
      });
      return {
        chamada: paraChamada(nova),
        senha: await this.resumo(tx, vigente.senhaId, usuario.unidadeId),
      };
    });
    this.eventos.emitir('senha.chamada', { senha, chamada });
    return chamada;
  }

  /** Devolve a senha a AGUARDANDO com a chegada original (RN-04); a chamada fica no histórico. */
  async cancelar(chamadaId: string, unidadeId: string): Promise<SenhaResumo> {
    const { mudanca, senha } = await this.senhas.transacao(async (tx) => {
      const vigente = await this.chamadaVigente(tx, chamadaId, unidadeId);
      const mudanca = await this.maquina.transicionar(tx, {
        senhaId: vigente.senhaId,
        unidadeId,
        versao: vigente.senha.versao,
        para: 'AGUARDANDO',
      });
      return { mudanca, senha: await this.resumo(tx, vigente.senhaId, unidadeId) };
    });
    this.maquina.publicar(mudanca);
    return senha;
  }

  /** A chamada precisa ser a última da senha, e a senha estar em CHAMADA. */
  private async chamadaVigente(
    tx: Transacao,
    chamadaId: string,
    unidadeId: string,
  ): Promise<ChamadaCompleta> {
    const chamada = await this.repositorio.buscarChamada(chamadaId, unidadeId, tx);
    if (!chamada) throw chamadaNaoEncontrada();
    const ultima = await this.repositorio.proximaSequencia(tx, chamada.senhaId);
    if (chamada.senha.status !== 'CHAMADA' || chamada.sequencia !== ultima - 1) {
      throw chamadaEncerrada();
    }
    return chamada;
  }

  private async resumo(tx: Transacao, senhaId: string, unidadeId: string): Promise<SenhaResumo> {
    return this.projecao.resumo((await this.senhas.buscar(senhaId, unidadeId, tx))!, tx);
  }
}
