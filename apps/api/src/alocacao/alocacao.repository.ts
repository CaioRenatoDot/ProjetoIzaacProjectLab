import { Injectable } from '@nestjs/common';
import { type DiaSemana, type Prisma, type Turno } from '@prisma/client';

import { type Transacao } from '../senhas/senhas.repository';
import { ALOCACAO_COMPLETA, type AlocacaoCompleta } from './alocacao.projecao';

const VIGENTE = { liberadaEm: null } satisfies Prisma.AlocacaoWhereInput;

/** Leituras e escritas da alocação; todas na transação de quem chama. */
@Injectable()
export class AlocacaoRepository {
  senhaParaAlocar(tx: Transacao, senhaId: string, unidadeId: string) {
    return tx.senha.findFirst({
      where: { id: senhaId, fila: { unidadeId } },
      select: {
        id: true,
        status: true,
        versao: true,
        filaId: true,
        fila: {
          select: {
            bloqueada: true,
            especialidadeId: true,
            especialidade: {
              select: {
                nome: true,
                exigeSupervisaoDocente: true,
                recursosExigidos: { select: { recursoId: true } },
              },
            },
          },
        },
      },
    });
  }

  vigente(tx: Transacao, senhaId: string): Promise<AlocacaoCompleta | null> {
    return tx.alocacao.findFirst({ where: { senhaId, ...VIGENTE }, include: ALOCACAO_COMPLETA });
  }

  liberar(tx: Transacao, alocacaoId: string, agora: Date): Promise<unknown> {
    return tx.alocacao.update({ where: { id: alocacaoId }, data: { liberadaEm: agora } });
  }

  estudante(tx: Transacao, id: string, diaSemana: DiaSemana | null, turno: Turno | null) {
    return tx.estudante.findFirst({
      where: { id },
      select: {
        ativo: true,
        especialidadeId: true,
        especialidade: { select: { unidadeId: true } },
        disponibilidades: diaSemana && turno ? { where: { diaSemana, turno } } : { take: 0 },
        _count: { select: { alocacoes: { where: VIGENTE } } },
      },
    });
  }

  sala(tx: Transacao, id: string) {
    return tx.sala.findFirst({
      where: { id },
      select: {
        ativo: true,
        unidadeId: true,
        situacao: true,
        recursos: { select: { recursoId: true } },
        _count: { select: { alocacoes: { where: VIGENTE } } },
      },
    });
  }

  /** Bloqueia a linha do supervisor até o fim da transação, antes de contar (RN-08). */
  async bloquearSupervisor(tx: Transacao, id: string): Promise<boolean> {
    const linhas = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM supervisor WHERE id = ${id}::uuid FOR UPDATE`;
    return linhas.length > 0;
  }

  supervisor(tx: Transacao, id: string, diaSemana: DiaSemana | null, turno: Turno | null) {
    return tx.supervisor.findFirst({
      where: { id },
      select: {
        ativo: true,
        limiteEstudantesSimultaneos: true,
        especialidades: { select: { especialidadeId: true } },
        disponibilidades: diaSemana && turno ? { where: { diaSemana, turno } } : { take: 0 },
        _count: { select: { alocacoes: { where: VIGENTE } } },
      },
    });
  }

  /** Supervisores ativos habilitados na especialidade, no turno, com a ocupação atual. */
  supervisoresNoTurno(
    tx: Transacao,
    especialidadeId: string,
    diaSemana: DiaSemana,
    turno: Turno,
    exceto?: string,
  ) {
    return tx.supervisor.findMany({
      where: {
        ativo: true,
        especialidades: { some: { especialidadeId } },
        disponibilidades: { some: { diaSemana, turno } },
        ...(exceto ? { NOT: { id: exceto } } : {}),
      },
      select: {
        limiteEstudantesSimultaneos: true,
        _count: { select: { alocacoes: { where: VIGENTE } } },
      },
    });
  }

  criar(
    tx: Transacao,
    dados: {
      senhaId: string;
      estudanteId: string;
      supervisorId: string | null;
      salaId: string;
      confirmadaPor: string;
    },
  ): Promise<AlocacaoCompleta> {
    return tx.alocacao.create({ data: dados, include: ALOCACAO_COMPLETA });
  }

  registrarRecursoFaltante(
    tx: Transacao,
    senhaId: string,
    recursoFaltante: 'ESTUDANTE' | 'SUPERVISOR' | 'SALA',
    observacao: string | null,
  ): Promise<unknown> {
    return tx.senha.update({
      where: { id: senhaId },
      data: { recursoFaltante, recursoFaltanteObservacao: observacao },
    });
  }

  /** RN-10: marca a fila como bloqueada; devolve falso se já estava. O desbloqueio é da 6.3. */
  async bloquearFila(tx: Transacao, filaId: string, motivo: string, agora: Date): Promise<boolean> {
    const { count } = await tx.fila.updateMany({
      where: { id: filaId, bloqueada: false },
      data: { bloqueada: true, bloqueadaMotivo: motivo, bloqueadaDesde: agora },
    });
    return count === 1;
  }
}
