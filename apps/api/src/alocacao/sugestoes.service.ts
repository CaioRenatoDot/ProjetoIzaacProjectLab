import { Injectable } from '@nestjs/common';

import { ErroDominio } from '../common/errors/erro-dominio';
import { Relogio } from '../common/relogio';
import { turnoAtual } from '../common/turno';
import { ParametrosService } from '../parametros/parametros.service';
import { ORDEM_RN04 } from '../filas/filas.repository';
import { SenhasRepository, type Transacao } from '../senhas/senhas.repository';
import { AlocacaoRepository } from './alocacao.repository';
import { ALOCAVEIS } from './alocacao.service';
import { AptidaoAlocacaoService, type Inaptidao } from './aptidao-alocacao.service';
import {
  type BlocoAlocacao,
  type CandidatoAlocacao,
  SugestoesAlocacao,
  SugestoesChamada,
} from './dto/sugestoes.dto';

interface EspecialidadeAlocada {
  especialidadeId: string;
  especialidade: { exigeSupervisaoDocente: boolean; recursosExigidos: { recursoId: string }[] };
}

const naoEncontrado = (titulo: string) =>
  new ErroDominio('NAO_ENCONTRADO', 404, titulo, 'O registro não existe ou foi removido.');

@Injectable()
export class SugestoesService {
  constructor(
    private readonly repository: AlocacaoRepository,
    private readonly senhas: SenhasRepository,
    private readonly parametros: ParametrosService,
    private readonly relogio: Relogio,
    private readonly aptidao: AptidaoAlocacaoService,
  ) {}

  consultar(senhaId: string, unidadeId: string): Promise<SugestoesAlocacao> {
    return this.senhas.transacao(async (tx) => {
      const senha = await this.repository.senhaParaAlocar(tx, senhaId, unidadeId);
      if (!senha) throw naoEncontrado('Senha não encontrada');
      if (!ALOCAVEIS.includes(senha.status))
        throw new ErroDominio('TRANSICAO_INVALIDA', 409, 'Ação indisponível para esta senha');
      return SugestoesAlocacao.parse({
        senhaId,
        ...(await this.blocos(tx, unidadeId, senha.fila)),
      });
    });
  }

  /** Prévia do "Chamar próxima" (#149): sem senha escolhida, pela especialidade da fila. */
  paraChamada(filaId: string, unidadeId: string): Promise<SugestoesChamada> {
    return this.senhas.transacao(async (tx) => {
      const fila = await tx.fila.findFirst({
        where: { id: filaId, unidadeId },
        select: {
          especialidadeId: true,
          especialidade: {
            select: {
              exigeSupervisaoDocente: true,
              recursosExigidos: { select: { recursoId: true } },
            },
          },
        },
      });
      if (!fila) throw naoEncontrado('Fila não encontrada');
      const proxima = await tx.senha.findFirst({
        where: { filaId, status: 'AGUARDANDO' },
        orderBy: ORDEM_RN04,
        select: { numero: true, prioridade: true },
      });
      return SugestoesChamada.parse({ proxima, ...(await this.blocos(tx, unidadeId, fila)) });
    });
  }

  private async blocos(tx: Transacao, unidadeId: string, fila: EspecialidadeAlocada) {
    const { especialidadeId } = fila;
    const { limiteEstudantesSupervisor: limite } = await this.parametros.vigentes(
      unidadeId,
      especialidadeId,
      tx,
    );
    const turno = turnoAtual(this.relogio.agora());
    const dia = turno?.diaSemana ?? null;
    const periodo = turno?.turno ?? null;
    const estudante = await this.bloco(
      (cursor) => this.repository.estudantes(tx, unidadeId, dia, periodo, cursor),
      (e) =>
        candidato(
          e.id,
          e.nome,
          `${e.especialidade.nome} · ${e.nivelFormacao}`,
          this.aptidao.estudante(e, unidadeId, especialidadeId),
        ),
      ['RN-05', 'RN-06'],
    );
    const aplicavel = fila.especialidade.exigeSupervisaoDocente;
    const supervisor = aplicavel
      ? await this.bloco(
          (cursor) => this.repository.supervisores(tx, unidadeId, dia, periodo, cursor),
          (s) =>
            candidato(
              s.id,
              s.nome,
              `${s._count.alocacoes} de ${s.limiteEstudantesSimultaneos ?? limite} estudantes`,
              this.aptidao.supervisor(s, especialidadeId, limite),
            ),
          ['RN-07', 'RN-08'],
        )
      : { sugestao: null, alternativas: [], regrasVerificadas: [] };
    const sala = await this.bloco(
      (cursor) => this.repository.salas(tx, unidadeId, cursor),
      (s) =>
        candidato(
          s.id,
          s.identificacao,
          s.recursos.map((r) => r.recurso.nome).join(', '),
          this.aptidao.sala(s, unidadeId, fila.especialidade.recursosExigidos),
        ),
      ['RN-09'],
    );
    return { estudante, supervisor: { ...supervisor, aplicavel }, sala };
  }

  /** Snapshot de até vinte alternativas; busca em lotes até encontrar uma sugestão apta. */
  private async bloco<T extends { id: string }>(
    ler: (cursor?: string) => Promise<T[]>,
    projetar: (item: T) => CandidatoAlocacao,
    regrasVerificadas: string[],
  ): Promise<BlocoAlocacao> {
    const bloco: BlocoAlocacao = { sugestao: null, alternativas: [], regrasVerificadas };
    let cursor: string | undefined;
    for (;;) {
      const itens = await ler(cursor);
      for (const item of itens) {
        const c = projetar(item);
        if (c.apto && !bloco.sugestao) bloco.sugestao = c;
        else if (bloco.alternativas.length < 20) bloco.alternativas.push(c);
      }
      if (itens.length < 100 || (bloco.sugestao && bloco.alternativas.length >= 20)) return bloco;
      cursor = itens.at(-1)!.id;
    }
  }
}

function candidato(
  id: string,
  nome: string,
  descricao: string,
  erro: Inaptidao | null,
): CandidatoAlocacao {
  return {
    id,
    nome,
    descricao,
    apto: !erro,
    motivoInaptidao: erro?.motivo ?? null,
    motivoTexto: erro?.texto ?? null,
  };
}
