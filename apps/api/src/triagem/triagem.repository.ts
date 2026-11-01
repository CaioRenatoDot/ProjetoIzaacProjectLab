import { Injectable } from '@nestjs/common';
import {
  type EnquadramentoLegal,
  type Prioridade,
  type Prisma,
  type TipoAtendimento,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export const COM_RELACOES = {
  paciente: { select: { nomeCompleto: true } },
  especialidadeDestino: { select: { nome: true } },
  _count: { select: { senhas: true } },
} satisfies Prisma.TriagemInclude;

export type TriagemComRelacoes = Prisma.TriagemGetPayload<{ include: typeof COM_RELACOES }>;

export interface NovaTriagem {
  pacienteId: string;
  profissionalId: string;
  especialidadeDestinoId: string;
  tipoAtendimento: TipoAtendimento;
  prioridade: Prioridade;
  motivo: string;
  enquadramentoLegal: EnquadramentoLegal | null;
  justificativaClinica: string | null;
  observacoes: string | null;
}

@Injectable()
export class TriagemRepository {
  constructor(private readonly prisma: PrismaService) {}

  pacienteAtivo(id: string, unidadeId: string): Promise<{ id: string } | null> {
    return this.prisma.paciente.findFirst({
      where: { id, unidadeId, ativo: true },
      select: { id: true },
    });
  }

  /** Especialidade ativa da unidade com fila ativa (Tabela 9, ID03). */
  especialidadeComFila(id: string, unidadeId: string): Promise<{ id: string } | null> {
    return this.prisma.especialidade.findFirst({
      where: { id, unidadeId, ativo: true, filas: { some: { ativa: true, unidadeId } } },
      select: { id: true },
    });
  }

  criar(dados: NovaTriagem): Promise<TriagemComRelacoes> {
    return this.prisma.triagem.create({ data: dados, include: COM_RELACOES });
  }

  buscar(id: string, unidadeId: string): Promise<TriagemComRelacoes | null> {
    return this.prisma.triagem.findFirst({
      where: { id, paciente: { unidadeId } },
      include: COM_RELACOES,
    });
  }

  listar(
    where: Prisma.TriagemWhereInput,
    paginacao: { skip: number; take: number },
  ): Promise<[TriagemComRelacoes[], number]> {
    return this.prisma.$transaction([
      this.prisma.triagem.findMany({
        where,
        include: COM_RELACOES,
        orderBy: [{ concluidaEm: 'desc' }, { id: 'desc' }],
        ...paginacao,
      }),
      this.prisma.triagem.count({ where }),
    ]);
  }
}
