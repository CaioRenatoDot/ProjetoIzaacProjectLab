import { Injectable } from '@nestjs/common';
import { type Prisma, type StatusSenha, type TipoAtendimento } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SENHA_COMPLETA, type SenhaCompleta, type Transacao } from '../senhas/senhas.repository';

export const FILA_COMPLETA = {
  especialidade: { select: { nome: true } },
} satisfies Prisma.FilaInclude;

export type FilaCompleta = Prisma.FilaGetPayload<{ include: typeof FILA_COMPLETA }>;

export const CHAMADA_COMPLETA = {
  usuario: { select: { nome: true } },
  senha: { select: { numero: true, status: true, versao: true, filaId: true } },
} satisfies Prisma.ChamadaInclude;

export type ChamadaCompleta = Prisma.ChamadaGetPayload<{ include: typeof CHAMADA_COMPLETA }>;

/** Ordem da RN-04 (o enum Prioridade está em ordem crescente; o id desempata). */
const ORDEM_RN04: Prisma.SenhaOrderByWithRelationInput[] = [
  { prioridade: 'desc' },
  { chegadaEm: 'asc' },
  { temAgendamentoPrevio: 'desc' },
  { id: 'asc' },
];

@Injectable()
export class FilasRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar(
    where: Prisma.FilaWhereInput,
    paginacao: { skip: number; take: number },
  ): Promise<[FilaCompleta[], number]> {
    return this.prisma.$transaction([
      this.prisma.fila.findMany({
        where,
        include: FILA_COMPLETA,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        ...paginacao,
      }),
      this.prisma.fila.count({ where }),
    ]);
  }

  buscar(id: string, unidadeId: string, tx?: Transacao): Promise<FilaCompleta | null> {
    return (tx ?? this.prisma).fila.findFirst({ where: { id, unidadeId }, include: FILA_COMPLETA });
  }

  especialidadeAtiva(id: string, unidadeId: string): Promise<{ id: string } | null> {
    return this.prisma.especialidade.findFirst({
      where: { id, unidadeId, ativo: true },
      select: { id: true },
    });
  }

  filaAtivaDaEspecialidade(especialidadeId: string, unidadeId: string, exceto?: string) {
    return this.prisma.fila.findFirst({
      where: {
        especialidadeId,
        unidadeId,
        ativa: true,
        ...(exceto ? { NOT: { id: exceto } } : {}),
      },
      select: { id: true },
    });
  }

  criar(dados: Prisma.FilaUncheckedCreateInput): Promise<FilaCompleta> {
    return this.prisma.fila.create({ data: dados, include: FILA_COMPLETA });
  }

  atualizar(id: string, dados: Prisma.FilaUncheckedUpdateInput): Promise<FilaCompleta> {
    return this.prisma.fila.update({ where: { id }, data: dados, include: FILA_COMPLETA });
  }

  contarSenhas(filaId: string): Promise<number> {
    return this.prisma.senha.count({ where: { filaId } });
  }

  excluir(id: string): Promise<unknown> {
    return this.prisma.$transaction([
      this.prisma.contadorSenha.deleteMany({ where: { filaId: id } }),
      this.prisma.fila.delete({ where: { id } }),
    ]);
  }

  quadro(
    filaId: string,
    status: StatusSenha[],
    tipoAtendimento: TipoAtendimento | undefined,
    paginacao: { skip: number; take: number },
  ): Promise<[SenhaCompleta[], number]> {
    const where: Prisma.SenhaWhereInput = {
      filaId,
      status: { in: status },
      ...(tipoAtendimento ? { tipoAtendimento } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.senha.findMany({
        where,
        include: SENHA_COMPLETA,
        orderBy: ORDEM_RN04,
        ...paginacao,
      }),
      this.prisma.senha.count({ where }),
    ]);
  }

  /** Contagens do cabeçalho do quadro; "hoje" no fuso da unidade. */
  async metricas(filaId: string) {
    const [porStatus, [hoje]] = await Promise.all([
      this.prisma.senha.groupBy({
        by: ['status'],
        where: { filaId, status: { in: ['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO', 'PAUSADO'] } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ ausencias: bigint; media: number | null }[]>`
        SELECT
          (SELECT count(*) FROM ausencia a JOIN senha s ON s.id = a.senha_id
            WHERE s.fila_id = ${filaId}::uuid
              AND (a.registrado_em AT TIME ZONE 'America/Sao_Paulo')::date
                  = (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS ausencias,
          (SELECT avg(extract(epoch FROM s.chamada_em - s.chegada_em) / 60)::float
             FROM senha s
            WHERE s.fila_id = ${filaId}::uuid AND s.chamada_em IS NOT NULL
              AND (s.chamada_em AT TIME ZONE 'America/Sao_Paulo')::date
                  = (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS media`,
    ]);
    const contagem = (status: StatusSenha) =>
      porStatus.find((linha) => linha.status === status)?._count._all ?? 0;
    return {
      aguardando: contagem('AGUARDANDO'),
      chamadas: contagem('CHAMADA'),
      emAtendimento: contagem('EM_ATENDIMENTO') + contagem('PAUSADO'),
      ausenciasHoje: Number(hoje!.ausencias),
      tempoMedioEsperaMinutos: hoje!.media === null ? null : Math.round(hoje!.media),
    };
  }

  /**
   * Próxima senha pela RN-04, com bloqueio de linha e salto das já bloqueadas: duas chamadas
   * simultâneas na mesma fila pegam senhas diferentes (DAS §6.1).
   */
  async proximaBloqueada(
    tx: Transacao,
    filaId: string,
  ): Promise<{ id: string; versao: number; prioridade: string; chegada_em: Date } | null> {
    const [senha] = await tx.$queryRaw<
      { id: string; versao: number; prioridade: string; chegada_em: Date }[]
    >`
      SELECT id, versao, prioridade::text AS prioridade, chegada_em
        FROM senha
       WHERE fila_id = ${filaId}::uuid AND status = 'AGUARDANDO'
       ORDER BY prioridade DESC, chegada_em ASC, tem_agendamento_previo DESC, id ASC
       LIMIT 1
         FOR UPDATE SKIP LOCKED`;
    return senha ?? null;
  }

  /** Há senha não urgente aguardando que chegou antes (confirmação de T-09, RN-03). */
  async haNaoUrgenteAnterior(tx: Transacao, filaId: string, chegadaEm: Date): Promise<boolean> {
    const total = await tx.senha.count({
      where: {
        filaId,
        status: 'AGUARDANDO',
        prioridade: { not: 'URGENTE' },
        chegadaEm: { lt: chegadaEm },
      },
    });
    return total > 0;
  }

  async proximaSequencia(tx: Transacao, senhaId: string): Promise<number> {
    const { _max } = await tx.chamada.aggregate({ where: { senhaId }, _max: { sequencia: true } });
    return (_max.sequencia ?? 0) + 1;
  }

  criarChamada(
    tx: Transacao,
    dados: { senhaId: string; usuarioId: string; localExibicao: string; sequencia: number },
  ): Promise<ChamadaCompleta> {
    return tx.chamada.create({ data: dados, include: CHAMADA_COMPLETA });
  }

  buscarChamada(id: string, unidadeId: string, tx: Transacao): Promise<ChamadaCompleta | null> {
    return tx.chamada.findFirst({
      where: { id, senha: { fila: { unidadeId } } },
      include: CHAMADA_COMPLETA,
    });
  }

  /** Rechamada: nova janela de tolerância, sem mudar o status (bloqueio otimista). */
  async renovarTolerancia(
    tx: Transacao,
    senhaId: string,
    versao: number,
    toleranciaAte: Date,
  ): Promise<boolean> {
    const { count } = await tx.senha.updateMany({
      where: { id: senhaId, versao },
      data: { toleranciaAte, versao: { increment: 1 } },
    });
    return count === 1;
  }
}
