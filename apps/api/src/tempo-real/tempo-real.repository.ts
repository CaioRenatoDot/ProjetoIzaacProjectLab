import { Injectable } from '@nestjs/common';
import { type ChamadaPublica } from '@filas/contracts';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TempoRealRepository {
  constructor(private readonly prisma: PrismaService) {}

  unidade(id: string) {
    return this.prisma.unidade.findUnique({ where: { id }, select: { id: true } });
  }

  especialidade(id: string, unidadeId: string) {
    return this.prisma.especialidade.findFirst({ where: { id, unidadeId }, select: { id: true } });
  }

  fila(id: string) {
    return this.prisma.fila.findUnique({
      where: { id },
      select: { id: true, unidadeId: true, especialidadeId: true },
    });
  }

  async filaDaSenha(id: string) {
    return (
      await this.prisma.senha.findUnique({
        where: { id },
        select: { fila: { select: { id: true, unidadeId: true, especialidadeId: true } } },
      })
    )?.fila;
  }

  chamadasPublicas(unidadeId: string, agora: Date): Promise<ChamadaPublica[]> {
    // A consulta não seleciona identificação de paciente, triagem ou prioridade.
    return this.prisma.$queryRaw<ChamadaPublica[]>`
      SELECT s.numero, e.nome AS especialidade, c.local_exibicao AS local
        FROM chamada c JOIN senha s ON s.id = c.senha_id
        JOIN fila f ON f.id = s.fila_id JOIN especialidade e ON e.id = f.especialidade_id
       WHERE f.unidade_id = ${unidadeId}::uuid
         AND (c.chamado_em AT TIME ZONE 'America/Sao_Paulo')::date
           = (${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
       ORDER BY c.chamado_em DESC, c.id DESC LIMIT 5`;
  }
}
