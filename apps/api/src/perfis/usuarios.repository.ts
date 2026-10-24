import { Injectable } from '@nestjs/common';
import { type MotivoRevogacao, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const COM_PERFIL = { perfil: { select: { nome: true } } } satisfies Prisma.UsuarioInclude;

export type UsuarioComPerfilNome = Prisma.UsuarioGetPayload<{ include: typeof COM_PERFIL }>;

export interface FiltroUsuarios {
  busca?: string;
  perfilId?: string;
  ativo?: boolean;
}

@Injectable()
export class UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroUsuarios, skip: number, take: number) {
    const where: Prisma.UsuarioWhereInput = {
      ...(filtro.perfilId ? { perfilId: filtro.perfilId } : {}),
      ...(filtro.ativo !== undefined ? { ativo: filtro.ativo } : {}),
      ...(filtro.busca
        ? {
            OR: [
              { nome: { contains: filtro.busca, mode: 'insensitive' } },
              { identificacao: { contains: filtro.busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where,
        include: COM_PERFIL,
        orderBy: { nome: 'asc' },
        skip,
        take,
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return { dados, total };
  }

  buscar(id: string): Promise<UsuarioComPerfilNome | null> {
    return this.prisma.usuario.findUnique({ where: { id }, include: COM_PERFIL });
  }

  buscarPorIdentificacao(identificacao: string) {
    return this.prisma.usuario.findUnique({ where: { identificacao }, select: { id: true } });
  }

  perfilExiste(id: string): Promise<boolean> {
    return this.prisma.perfil.count({ where: { id } }).then((total) => total > 0);
  }

  criar(dados: Prisma.UsuarioUncheckedCreateInput): Promise<UsuarioComPerfilNome> {
    return this.prisma.usuario.create({ data: dados, include: COM_PERFIL });
  }

  /**
   * Altera o usuário e, na mesma transação, encerra as sessões indicadas: inativar e redefinir
   * a senha valem na hora (docs/04 §2). `manterSessao` preserva a sessão de quem redefine a
   * própria senha.
   */
  alterar(
    id: string,
    dados: Prisma.UsuarioUncheckedUpdateInput,
    revogacao?: { motivo: MotivoRevogacao; manterSessao?: string },
  ): Promise<UsuarioComPerfilNome> {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({ where: { id }, data: dados, include: COM_PERFIL });
      if (revogacao) {
        await tx.sessao.updateMany({
          where: {
            usuarioId: id,
            revogadaEm: null,
            ...(revogacao.manterSessao ? { NOT: { id: revogacao.manterSessao } } : {}),
          },
          data: { revogadaEm: new Date(), motivoRevogacao: revogacao.motivo },
        });
      }
      return usuario;
    });
  }
}
