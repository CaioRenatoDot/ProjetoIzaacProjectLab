import { Injectable } from '@nestjs/common';
import {
  type ListarSupervisoresQuery,
  type RespostaPaginada,
  type Supervisor,
  type SupervisorEntrada,
} from '@filas/contracts';
import { Prisma } from '@prisma/client';

import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { PrismaService } from '../prisma/prisma.service';
import {
  doBanco,
  idsInexistentes,
  normalizarNome,
  paraBanco,
  pessoaComVinculo,
  pessoaNaoEncontrada,
} from './pessoas.util';
import { exigirConfirmacao, mesmoConjunto, usoPorAlocacao } from './impacto';

const DETALHE = {
  especialidades: { select: { especialidade: { select: { id: true, nome: true } } } },
  procedimentos: { select: { procedimento: { select: { id: true, nome: true } } } },
  disponibilidades: { select: { diaSemana: true, turno: true } },
  _count: { select: { alocacoes: { where: { liberadaEm: null } } } },
} satisfies Prisma.SupervisorInclude;

type SupervisorComDetalhe = Prisma.SupervisorGetPayload<{ include: typeof DETALHE }>;

function paraSupervisor(supervisor: SupervisorComDetalhe): Supervisor {
  return {
    id: supervisor.id,
    nome: supervisor.nome,
    especialidades: supervisor.especialidades.map(({ especialidade }) => especialidade),
    procedimentos: supervisor.procedimentos.map(({ procedimento }) => procedimento),
    disponibilidade: supervisor.disponibilidades.map(doBanco),
    limiteEstudantesSimultaneos: supervisor.limiteEstudantesSimultaneos ?? 0,
    ocupacaoAtual: supervisor._count.alocacoes,
    ativo: supervisor.ativo,
  };
}

/**
 * Supervisor (Tabela 3, RN-07, RN-08). Sem verificação de duplicidade (Tabela A). A unidade
 * vem das especialidades habilitadas (RNF-08).
 */
@Injectable()
export class SupervisoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarSupervisoresQuery,
    unidadeId: string,
  ): Promise<RespostaPaginada<Supervisor>> {
    const where: Prisma.SupervisorWhereInput = {
      especialidades: {
        some: {
          especialidade: { unidadeId },
          ...(query.especialidadeId ? { especialidadeId: query.especialidadeId } : {}),
        },
      },
      ...(query.busca ? { nome: { contains: query.busca, mode: 'insensitive' } } : {}),
      ...(query.turno ? { disponibilidades: { some: { turno: query.turno } } } : {}),
      ...(query.disponivel !== undefined ? { ativo: query.disponivel } : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.supervisor.findMany({
        where,
        include: DETALHE,
        orderBy: { nome: query.direcao },
        ...deslocamento(query),
      }),
      this.prisma.supervisor.count({ where }),
    ]);
    return montarRespostaPaginada(dados.map(paraSupervisor), total, query);
  }

  async consultar(id: string, unidadeId: string): Promise<Supervisor> {
    return paraSupervisor(await this.buscar(id, unidadeId));
  }

  async criar(entrada: SupervisorEntrada, unidadeId: string): Promise<Supervisor> {
    await this.validarReferencias(entrada, unidadeId);
    const supervisor = await this.prisma.supervisor.create({
      data: {
        nome: normalizarNome(entrada.nome),
        limiteEstudantesSimultaneos: entrada.limiteEstudantesSimultaneos,
        ...this.vinculos(entrada),
      },
      include: DETALHE,
    });
    return paraSupervisor(supervisor);
  }

  async atualizar(
    id: string,
    entrada: SupervisorEntrada,
    unidadeId: string,
    confirmar = false,
  ): Promise<Supervisor> {
    const atual = paraSupervisor(await this.buscar(id, unidadeId));
    const campos = [
      ...(mesmoConjunto(
        atual.especialidades.map((e) => e.id),
        entrada.especialidadesIds,
      )
        ? []
        : ['especialidadesIds']),
      ...(mesmoConjunto(
        atual.procedimentos.map((p) => p.id),
        entrada.procedimentosIds,
      )
        ? []
        : ['procedimentosIds']),
      ...(mesmoConjunto(
        atual.disponibilidade.map((d) => `${d.diaSemana}-${d.turno}`),
        entrada.disponibilidade.map((d) => `${d.diaSemana}-${d.turno}`),
      )
        ? []
        : ['disponibilidade']),
      ...((atual.limiteEstudantesSimultaneos || null) ===
      (entrada.limiteEstudantesSimultaneos ?? null)
        ? []
        : ['limiteEstudantesSimultaneos']),
    ];
    if (campos.length) {
      exigirConfirmacao(
        confirmar,
        await usoPorAlocacao(this.prisma, 'Supervisor', { supervisorId: id }),
        campos,
      );
    }
    await this.validarReferencias(entrada, unidadeId);
    const supervisor = await this.prisma.$transaction(async (tx) => {
      await tx.supervisorEspecialidade.deleteMany({ where: { supervisorId: id } });
      await tx.supervisorProcedimento.deleteMany({ where: { supervisorId: id } });
      await tx.supervisorDisponibilidade.deleteMany({ where: { supervisorId: id } });
      return tx.supervisor.update({
        where: { id },
        data: {
          nome: normalizarNome(entrada.nome),
          limiteEstudantesSimultaneos: entrada.limiteEstudantesSimultaneos,
          ...this.vinculos(entrada),
        },
        include: DETALHE,
      });
    });
    return paraSupervisor(supervisor);
  }

  async alterarSituacao(
    id: string,
    ativo: boolean,
    unidadeId: string,
    confirmar = false,
  ): Promise<Supervisor> {
    const atual = await this.buscar(id, unidadeId);
    if (atual.ativo && !ativo) {
      exigirConfirmacao(
        confirmar,
        await usoPorAlocacao(this.prisma, 'Supervisor', { supervisorId: id }),
        ['ativo'],
      );
    }
    return paraSupervisor(
      await this.prisma.supervisor.update({ where: { id }, data: { ativo }, include: DETALHE }),
    );
  }

  async excluir(id: string, unidadeId: string): Promise<void> {
    await this.buscar(id, unidadeId);
    try {
      await this.prisma.supervisor.delete({ where: { id } });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2003') {
        throw pessoaComVinculo('Supervisor');
      }
      throw erro;
    }
  }

  private vinculos(entrada: SupervisorEntrada) {
    return {
      especialidades: {
        create: entrada.especialidadesIds.map((especialidadeId) => ({ especialidadeId })),
      },
      procedimentos: {
        create: entrada.procedimentosIds.map((procedimentoId) => ({ procedimentoId })),
      },
      disponibilidades: { create: entrada.disponibilidade.map(paraBanco) },
    };
  }

  private async buscar(id: string, unidadeId: string): Promise<SupervisorComDetalhe> {
    const supervisor = await this.prisma.supervisor.findFirst({
      where: { id, especialidades: { some: { especialidade: { unidadeId } } } },
      include: DETALHE,
    });
    if (!supervisor) throw pessoaNaoEncontrada('Supervisor');
    return supervisor;
  }

  private async validarReferencias(entrada: SupervisorEntrada, unidadeId: string): Promise<void> {
    const [especialidades, procedimentos] = await Promise.all([
      this.prisma.especialidade.count({
        where: { id: { in: entrada.especialidadesIds }, unidadeId },
      }),
      this.prisma.procedimento.count({ where: { id: { in: entrada.procedimentosIds } } }),
    ]);
    if (especialidades !== entrada.especialidadesIds.length) {
      throw idsInexistentes('especialidadesIds', 'especialidades');
    }
    if (procedimentos !== entrada.procedimentosIds.length) {
      throw idsInexistentes('procedimentosIds', 'procedimentos');
    }
  }
}
