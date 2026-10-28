import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';

import { type Transacao } from '../senhas/senhas.repository';

@Injectable()
export class EncaminhamentosRepository {
  async origem(tx: Transacao, id: string, unidadeId: string) {
    const registros = await tx.$queryRaw<{ id: string }[]>`
      SELECT a.id FROM atendimento a JOIN senha s ON s.id = a.senha_id
        JOIN fila f ON f.id = s.fila_id
      WHERE a.id = ${id}::uuid AND f.unidade_id = ${unidadeId}::uuid FOR UPDATE OF a`;
    if (!registros.length) return null;
    return tx.atendimento.findUnique({
      where: { id },
      select: {
        id: true,
        desfecho: true,
        senha: {
          select: {
            id: true,
            triagemId: true,
            pacienteId: true,
            status: true,
            prioridade: true,
            tipoAtendimento: true,
            triagem: { select: { enquadramentoLegal: true } },
          },
        },
      },
    });
  }

  existente(tx: Transacao, atendimentoId: string) {
    return tx.encaminhamento.findFirst({ where: { atendimentoId }, select: { id: true } });
  }

  async destino(tx: Transacao, id: string, unidadeId: string) {
    const registros = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM especialidade WHERE id = ${id}::uuid AND unidade_id = ${unidadeId}::uuid FOR SHARE`;
    if (!registros.length) return null;
    return tx.especialidade.findUnique({
      where: { id },
      select: { id: true, nome: true, ativo: true },
    });
  }

  criar(tx: Transacao, data: Prisma.EncaminhamentoUncheckedCreateInput) {
    return tx.encaminhamento.create({ data });
  }
}
