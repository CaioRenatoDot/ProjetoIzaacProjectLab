import { Injectable } from '@nestjs/common';
import {
  type Aviso,
  type EmitirSenhaEntrada,
  type Reclassificacao,
  type ReclassificacaoResposta,
  type ReclassificarEntrada,
  type SenhaDetalhe,
  type SenhaEmitida,
  type SenhaResumo,
  type StatusSenha,
} from '@filas/contracts';

import { EventosDominio } from '../common/eventos/eventos-dominio';
import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';
import { ParametrosService } from '../parametros/parametros.service';
import { TriagemService } from '../triagem/triagem.service';
import { SenhaProjecao } from './senha-projecao.service';
import { type SenhaCompleta, SenhasRepository } from './senhas.repository';

/** "Ainda não atendida" (UC-07, T-08): antes de o atendimento começar. */
const RECLASSIFICAVEIS: StatusSenha[] = ['AGUARDANDO', 'CHAMADA', 'AGUARDANDO_RECURSO'];

/** Letra da fila + sequência do dia com três dígitos; a partir de 1000, quatro (openapi). */
export function numeroDaSenha(letra: string, sequencia: number): string {
  return `${letra}${String(sequencia).padStart(3, '0')}`;
}

const naoEncontrada = () =>
  new ErroDominio(
    'NAO_ENCONTRADO',
    404,
    'Senha não encontrada',
    'O registro não existe ou foi removido.',
  );

/**
 * Emissão (UC-06) e reclassificação (UC-07) de senha. A ordem da fila é a RN-04; a mudança de
 * prioridade exige justificativa com o mínimo do parâmetro da unidade (RN-01).
 */
@Injectable()
export class SenhasService {
  constructor(
    private readonly repositorio: SenhasRepository,
    private readonly projecao: SenhaProjecao,
    private readonly parametros: ParametrosService,
    private readonly triagens: TriagemService,
    private readonly eventos: EventosDominio,
  ) {}

  async emitir(entrada: EmitirSenhaEntrada, unidadeId: string): Promise<SenhaEmitida> {
    const id = await this.repositorio.transacao(async (tx) => {
      const triagem = await this.repositorio.triagemBloqueada(tx, entrada.triagemId, unidadeId);
      if (!triagem) {
        throw new ErroValidacao([{ campo: 'triagemId', mensagem: 'Triagem não encontrada.' }]);
      }
      const existente = await this.repositorio.senhaDaTriagem(tx, triagem.id);
      if (existente) {
        throw new ErroDominio(
          'DUPLICIDADE',
          409,
          'Senha já emitida',
          'Esta triagem já gerou uma senha. Consulte a senha existente.',
          { recursoExistenteId: existente.id },
        );
      }
      const fila = await this.repositorio.filaAtiva(tx, triagem.especialidadeDestinoId, unidadeId);
      if (!fila) {
        throw new ErroDominio(
          'SEM_FILA_CONFIGURADA',
          409,
          'Especialidade sem fila configurada',
          'A especialidade de destino não tem fila ativa, então a senha não pode ser emitida. Peça à administração para configurar a fila da especialidade.',
        );
      }
      const sequencia = await this.repositorio.proximaSequencia(tx, fila.id);
      return (
        await this.repositorio.criar(tx, {
          numero: numeroDaSenha(fila.letraSenha, sequencia),
          filaId: fila.id,
          triagemId: triagem.id,
          pacienteId: triagem.pacienteId,
          prioridade: triagem.prioridade,
          tipoAtendimento: entrada.tipoAtendimento ?? triagem.tipoAtendimento,
          temAgendamentoPrevio: entrada.temAgendamentoPrevio,
        })
      ).id;
    });

    const senha = (await this.repositorio.buscar(id, unidadeId))!;
    const resumo = await this.projecao.resumo(senha);
    this.eventos.emitir('senha.criada', resumo);
    const avisos: Aviso[] = senha.fila.bloqueada
      ? [
          {
            codigo: 'FILA_BLOQUEADA',
            mensagem: `A fila de ${senha.fila.especialidade.nome} está com a chamada suspensa por falta de supervisor disponível. A senha foi emitida e será chamada quando a fila for liberada.`,
          },
        ]
      : [];
    return { ...resumo, posicaoEstimada: resumo.posicao ?? 1, avisos };
  }

  async consultar(id: string, unidadeId: string): Promise<SenhaResumo> {
    return this.projecao.resumo(await this.buscar(id, unidadeId));
  }

  async consultarDetalhe(id: string, unidadeId: string): Promise<SenhaDetalhe> {
    const senha = await this.buscar(id, unidadeId);
    return {
      ...(await this.projecao.resumo(senha)),
      pacienteId: senha.pacienteId,
      pacienteNome: senha.paciente.nomeCompleto,
      triagem: await this.triagens.consultar(senha.triagemId, unidadeId),
      // A alocação entra com a parte 7.1 (#21).
      alocacao: null,
      senhaOrigemId: senha.senhaOrigemId,
    };
  }

  async reclassificar(
    id: string,
    entrada: ReclassificarEntrada,
    usuarioId: string,
    unidadeId: string,
  ): Promise<ReclassificacaoResposta> {
    const atual = await this.buscar(id, unidadeId);
    const { justificativaMinCaracteres: minimo } = await this.parametros.vigentes(
      unidadeId,
      atual.fila.especialidadeId,
    );

    await this.repositorio.transacao(async (tx) => {
      const senha = (await this.repositorio.buscar(id, unidadeId, tx))!;
      if (senha.versao !== entrada.versao)
        throw await this.projecao.versaoDesatualizada(id, unidadeId, tx);
      if (!RECLASSIFICAVEIS.includes(senha.status)) {
        throw new ErroDominio(
          'TRANSICAO_INVALIDA',
          409,
          'Senha já atendida',
          'Só é possível reclassificar a prioridade de senha que ainda não começou a ser atendida.',
        );
      }
      if (senha.prioridade === entrada.prioridade) {
        throw new ErroValidacao([
          { campo: 'prioridade', mensagem: 'Escolha uma prioridade diferente da atual.' },
        ]);
      }
      // RN-01: o mínimo é parâmetro editável da unidade, por isso não é CHECK no banco.
      if (entrada.justificativa.length < minimo) {
        throw new ErroDominio(
          'JUSTIFICATIVA_OBRIGATORIA',
          422,
          'Justificativa obrigatória',
          'Explique o motivo da mudança de prioridade.',
          {
            minimo,
            campos: [
              {
                campo: 'justificativa',
                mensagem: `A justificativa precisa ter pelo menos ${minimo} caracteres.`,
              },
            ],
          },
        );
      }
      const alterou = await this.repositorio.reclassificar(
        tx,
        id,
        entrada.versao,
        entrada.prioridade,
      );
      if (!alterou) throw await this.projecao.versaoDesatualizada(id, unidadeId, tx);
      await this.repositorio.registrarReclassificacao(tx, {
        senhaId: id,
        dePrioridade: senha.prioridade,
        paraPrioridade: entrada.prioridade,
        justificativa: entrada.justificativa,
        usuarioId,
      });
    });

    const resumo = await this.projecao.resumo(await this.buscar(id, unidadeId));
    this.eventos.emitir('senha.reclassificada', {
      senhaId: id,
      prioridade: resumo.prioridade,
      novaPosicao: resumo.posicao,
    });
    return { senha: resumo, novaPosicao: resumo.posicao };
  }

  async historico(id: string, unidadeId: string): Promise<Reclassificacao[]> {
    await this.buscar(id, unidadeId);
    const linhas = await this.repositorio.reclassificacoes(id);
    return linhas.map((linha) => ({
      id: linha.id,
      dePrioridade: linha.dePrioridade,
      paraPrioridade: linha.paraPrioridade,
      justificativa: linha.justificativa,
      usuarioNome: linha.usuario.nome,
      ocorridoEm: linha.ocorridoEm.toISOString(),
    }));
  }

  private async buscar(id: string, unidadeId: string): Promise<SenhaCompleta> {
    const senha = await this.repositorio.buscar(id, unidadeId);
    if (!senha) throw naoEncontrada();
    return senha;
  }
}
