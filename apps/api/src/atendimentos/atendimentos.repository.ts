import { Injectable } from '@nestjs/common';
import { type Desfecho, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { type Transacao } from '../senhas/senhas.repository';

export const ATENDIMENTO_COMPLETO = {
  senha: {
    select: {
      numero: true,
      status: true,
      versao: true,
      triagemId: true,
      paciente: { select: { nomeCompleto: true } },
      fila: { select: { unidadeId: true, especialidade: { select: { nome: true } } } },
    },
  },
  alocacao: {
    select: {
      estudante: { select: { nome: true } },
      supervisor: { select: { nome: true } },
      sala: { select: { identificacao: true } },
    },
  },
  pausas: { orderBy: { pausadoEm: 'asc' } },
  validador: { select: { nome: true } },
} satisfies Prisma.AtendimentoInclude;

export type AtendimentoCompleto = Prisma.AtendimentoGetPayload<{
  include: typeof ATENDIMENTO_COMPLETO;
}>;

@Injectable()
export class AtendimentosRepository {
  constructor(private readonly prisma: PrismaService) {}

  buscar(id: string, unidadeId: string, tx?: Transacao): Promise<AtendimentoCompleto | null> {
    return (tx ?? this.prisma).atendimento.findFirst({
      where: { id, senha: { fila: { unidadeId } } },
      include: ATENDIMENTO_COMPLETO,
    });
  }

  listar(
    where: Prisma.AtendimentoWhereInput,
    paginacao: { skip: number; take: number },
  ): Promise<[AtendimentoCompleto[], number]> {
    return this.prisma.$transaction([
      this.prisma.atendimento.findMany({
        where,
        include: ATENDIMENTO_COMPLETO,
        orderBy: [{ iniciadoEm: 'desc' }, { id: 'desc' }],
        ...paginacao,
      }),
      this.prisma.atendimento.count({ where }),
    ]);
  }

  /** Senha a iniciar, com a alocação vigente e o que a especialidade exige. */
  senhaParaIniciar(tx: Transacao, senhaId: string, unidadeId: string) {
    return tx.senha.findFirst({
      where: { id: senhaId, fila: { unidadeId } },
      select: {
        versao: true,
        fila: {
          select: {
            especialidade: {
              select: { exigeSupervisaoDocente: true, exigeValidacaoEncerramento: true },
            },
          },
        },
        alocacoes: {
          where: { liberadaEm: null },
          select: {
            id: true,
            supervisorId: true,
            estudante: { select: { ativo: true } },
            supervisor: { select: { ativo: true } },
            sala: { select: { ativo: true, situacao: true } },
          },
        },
      },
    });
  }

  recursosDaAlocacao(tx: Transacao, alocacaoId: string) {
    return tx.alocacao.findUniqueOrThrow({
      where: { id: alocacaoId },
      select: {
        estudante: { select: { ativo: true } },
        sala: { select: { ativo: true, situacao: true } },
      },
    });
  }

  criar(
    tx: Transacao,
    dados: { senhaId: string; alocacaoId: string; validacaoExigida: boolean; iniciadoEm: Date },
  ): Promise<{ id: string }> {
    return tx.atendimento.create({ data: dados, select: { id: true } });
  }

  atualizar(tx: Transacao, id: string, dados: Prisma.AtendimentoUncheckedUpdateInput) {
    return tx.atendimento.update({
      where: { id },
      data: { ...dados, versao: { increment: 1 } },
    });
  }

  abrirPausa(
    tx: Transacao,
    dados: { atendimentoId: string; motivo: string | null; pausadoPor: string; pausadoEm: Date },
  ): Promise<unknown> {
    return tx.pausaAtendimento.create({ data: dados });
  }

  fecharPausa(tx: Transacao, atendimentoId: string, agora: Date): Promise<unknown> {
    return tx.pausaAtendimento.updateMany({
      where: { atendimentoId, retomadoEm: null },
      data: { retomadoEm: agora },
    });
  }

  liberarAlocacao(tx: Transacao, alocacaoId: string, agora: Date): Promise<unknown> {
    return tx.alocacao.updateMany({
      where: { id: alocacaoId, liberadaEm: null },
      data: { liberadaEm: agora },
    });
  }

  registrarDesfecho(
    tx: Transacao,
    id: string,
    desfecho: Desfecho,
    observacoes: string | null,
    encerradoEm: Date,
  ) {
    return this.atualizar(tx, id, { desfecho, observacoes, encerradoEm });
  }
}
