import { Injectable } from '@nestjs/common';

import { ErroDominio } from '../common/errors/erro-dominio';
import { Relogio } from '../common/relogio';
import { turnoAtual } from '../common/turno';
import { ParametrosService } from '../parametros/parametros.service';
import { SenhasRepository } from '../senhas/senhas.repository';
import { AlocacaoRepository } from './alocacao.repository';
import { ALOCAVEIS } from './alocacao.service';
import { AptidaoAlocacaoService, type Inaptidao } from './aptidao-alocacao.service';
import { type BlocoAlocacao, type CandidatoAlocacao, SugestoesAlocacao } from './dto/sugestoes.dto';

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
      if (!senha)
        throw new ErroDominio(
          'NAO_ENCONTRADO',
          404,
          'Senha não encontrada',
          'O registro não existe ou foi removido.',
        );
      if (!ALOCAVEIS.includes(senha.status))
        throw new ErroDominio('TRANSICAO_INVALIDA', 409, 'Ação indisponível para esta senha');
      const especialidadeId = senha.fila.especialidadeId;
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
      const aplicavel = senha.fila.especialidade.exigeSupervisaoDocente;
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
            this.aptidao.sala(s, unidadeId, senha.fila.especialidade.recursosExigidos),
          ),
        ['RN-09'],
      );
      return SugestoesAlocacao.parse({
        senhaId,
        estudante,
        supervisor: { ...supervisor, aplicavel },
        sala,
      });
    });
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
