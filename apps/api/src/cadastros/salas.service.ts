import { Injectable } from '@nestjs/common';
import {
  type ListarSalasQuery,
  type RespostaPaginada,
  type Sala,
  type SalaEntrada,
} from '@filas/contracts';
import { Prisma } from '@prisma/client';

import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { PrismaService } from '../prisma/prisma.service';
import { naoEncontrado, recursosInexistentes, vinculoAtivo } from './erros';
import { exigirConfirmacao, mesmoConjunto, usoPorAlocacao } from './impacto';

const COM_RECURSOS = {
  recursos: { select: { recurso: { select: { id: true, nome: true } } } },
  _count: { select: { alocacoes: { where: { liberadaEm: null } } } },
} satisfies Prisma.SalaInclude;

/** Pronta para alocar: disponível, ativa e sem alocação vigente (RN-09). */
const LIVRE = {
  situacao: 'DISPONIVEL',
  ativo: true,
  alocacoes: { none: { liberadaEm: null } },
} satisfies Prisma.SalaWhereInput;

type SalaComRecursos = Prisma.SalaGetPayload<{ include: typeof COM_RECURSOS }>;

function paraSala(sala: SalaComRecursos): Sala {
  return {
    id: sala.id,
    identificacao: sala.identificacao,
    caracteristicas: sala.caracteristicas ?? '',
    recursos: sala.recursos.map(({ recurso }) => recurso),
    situacao: sala.situacao,
    ocupada: sala._count.alocacoes > 0,
    ativo: sala.ativo,
  };
}

/** Sala (Tabela 4, RN-09). Sem verificação de duplicidade (Tabela A). Sempre da unidade de quem consulta. */
@Injectable()
export class SalasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarSalasQuery, unidadeId: string): Promise<RespostaPaginada<Sala>> {
    const where: Prisma.SalaWhereInput = {
      unidadeId,
      ...(query.busca ? { identificacao: { contains: query.busca, mode: 'insensitive' } } : {}),
      ...(query.recursoId ? { recursos: { some: { recursoId: query.recursoId } } } : {}),
      ...(query.disponivel === true ? LIVRE : {}),
      ...(query.disponivel === false ? { NOT: LIVRE } : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.sala.findMany({
        where,
        include: COM_RECURSOS,
        orderBy: { [query.ordenar]: query.direcao },
        ...deslocamento(query),
      }),
      this.prisma.sala.count({ where }),
    ]);
    return montarRespostaPaginada(dados.map(paraSala), total, query);
  }

  async consultar(id: string, unidadeId: string): Promise<Sala> {
    return paraSala(await this.buscar(id, unidadeId));
  }

  async criar(entrada: SalaEntrada, unidadeId: string): Promise<Sala> {
    await this.garantirRecursos(entrada.recursosIds);
    const sala = await this.prisma.sala.create({
      data: {
        identificacao: entrada.identificacao,
        caracteristicas: entrada.caracteristicas ?? null,
        situacao: entrada.situacao,
        unidadeId,
        recursos: { create: entrada.recursosIds.map((recursoId) => ({ recursoId })) },
      },
      include: COM_RECURSOS,
    });
    return paraSala(sala);
  }

  async atualizar(
    id: string,
    entrada: SalaEntrada,
    unidadeId: string,
    confirmar = false,
  ): Promise<Sala> {
    const atual = await this.buscar(id, unidadeId);
    await this.garantirRecursos(entrada.recursosIds);
    const campos = [
      ...(mesmoConjunto(
        atual.recursos.map(({ recurso }) => recurso.id),
        entrada.recursosIds,
      )
        ? []
        : ['recursos']),
      ...(atual.situacao === entrada.situacao ? [] : ['situacao']),
    ];
    if (campos.length) {
      exigirConfirmacao(
        confirmar,
        await usoPorAlocacao(this.prisma, 'Sala', { salaId: id }),
        campos,
      );
    }
    const sala = await this.prisma.$transaction(async (tx) => {
      await tx.salaRecurso.deleteMany({ where: { salaId: id } });
      return tx.sala.update({
        where: { id },
        data: {
          identificacao: entrada.identificacao,
          caracteristicas: entrada.caracteristicas ?? null,
          situacao: entrada.situacao,
          recursos: { create: entrada.recursosIds.map((recursoId) => ({ recursoId })) },
        },
        include: COM_RECURSOS,
      });
    });
    return paraSala(sala);
  }

  async alterarSituacao(
    id: string,
    ativo: boolean,
    unidadeId: string,
    confirmar = false,
  ): Promise<Sala> {
    const atual = await this.buscar(id, unidadeId);
    if (atual.ativo && !ativo) {
      exigirConfirmacao(confirmar, await usoPorAlocacao(this.prisma, 'Sala', { salaId: id }), [
        'ativo',
      ]);
    }
    return paraSala(
      await this.prisma.sala.update({ where: { id }, data: { ativo }, include: COM_RECURSOS }),
    );
  }

  async excluir(id: string, unidadeId: string): Promise<void> {
    await this.buscar(id, unidadeId);
    try {
      await this.prisma.sala.delete({ where: { id } });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2003') {
        throw vinculoAtivo('A sala', 'alocações de atendimento');
      }
      throw erro;
    }
  }

  private async buscar(id: string, unidadeId: string): Promise<SalaComRecursos> {
    const sala = await this.prisma.sala.findFirst({
      where: { id, unidadeId },
      include: COM_RECURSOS,
    });
    if (!sala) throw naoEncontrado('Sala');
    return sala;
  }

  private async garantirRecursos(ids: string[]): Promise<void> {
    if (
      ids.length &&
      (await this.prisma.recurso.count({ where: { id: { in: ids } } })) !== ids.length
    ) {
      throw recursosInexistentes('recursosIds');
    }
  }
}
