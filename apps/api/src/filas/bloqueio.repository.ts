import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { type Transacao } from '../senhas/senhas.repository';

@Injectable()
export class BloqueioRepository {
  constructor(private readonly prisma: PrismaService) {}

  transacao<T>(trabalho: (tx: Transacao) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(trabalho);
  }

  async fila(tx: Transacao, id: string, unidadeId: string) {
    await tx.$queryRaw`SELECT id FROM fila WHERE id = ${id}::uuid
      AND unidade_id = ${unidadeId}::uuid FOR UPDATE`;
    return tx.fila.findFirst({
      where: { id, unidadeId },
      include: { especialidade: { select: { nome: true, exigeSupervisaoDocente: true } } },
    });
  }

  gravar(tx: Transacao, id: string, bloqueada: boolean, motivo: string, agora: Date) {
    return tx.fila.update({
      where: { id },
      data: {
        bloqueada,
        bloqueadaMotivo: bloqueada ? motivo : null,
        bloqueadaDesde: bloqueada ? agora : null,
      },
    });
  }

  monitoradas() {
    return this.prisma.fila.findMany({
      where: { OR: [{ ativa: true }, { bloqueada: true }] },
      select: { id: true, unidadeId: true },
    });
  }
}
