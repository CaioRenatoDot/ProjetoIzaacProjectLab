import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const DETALHE = {
  permissoes: { select: { permissao: true } },
  _count: { select: { usuarios: true } },
} satisfies Prisma.PerfilInclude;

export type PerfilComDetalhe = Prisma.PerfilGetPayload<{ include: typeof DETALHE }>;

@Injectable()
export class PerfisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(busca: string | undefined, skip: number, take: number) {
    const where: Prisma.PerfilWhereInput = busca
      ? { nome: { contains: busca, mode: 'insensitive' } }
      : {};
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.perfil.findMany({
        where,
        include: DETALHE,
        orderBy: { nome: 'asc' },
        skip,
        take,
      }),
      this.prisma.perfil.count({ where }),
    ]);
    return { dados, total };
  }

  buscar(id: string): Promise<PerfilComDetalhe | null> {
    return this.prisma.perfil.findUnique({ where: { id }, include: DETALHE });
  }

  /** Nome igual sem diferenciar maiúsculas, opcionalmente ignorando o próprio perfil. */
  buscarPorNome(nome: string, exceto?: string) {
    return this.prisma.perfil.findFirst({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        ...(exceto ? { NOT: { id: exceto } } : {}),
      },
      select: { id: true },
    });
  }

  criar(dados: {
    nome: string;
    descricao?: string;
    permissoes: string[];
  }): Promise<PerfilComDetalhe> {
    return this.prisma.perfil.create({
      data: {
        nome: dados.nome,
        descricao: dados.descricao ?? null,
        permissoes: { create: dados.permissoes.map((permissao) => ({ permissao })) },
      },
      include: DETALHE,
    });
  }

  /** Troca nome, descrição e o conjunto de permissões na mesma transação. */
  atualizar(
    id: string,
    dados: { nome: string; descricao?: string; permissoes: string[] },
  ): Promise<PerfilComDetalhe> {
    return this.prisma.$transaction(async (tx) => {
      await tx.perfilPermissao.deleteMany({ where: { perfilId: id } });
      return tx.perfil.update({
        where: { id },
        data: {
          nome: dados.nome,
          descricao: dados.descricao ?? null,
          permissoes: { create: dados.permissoes.map((permissao) => ({ permissao })) },
        },
        include: DETALHE,
      });
    });
  }

  async excluir(id: string): Promise<void> {
    await this.prisma.perfil.delete({ where: { id } });
  }
}
