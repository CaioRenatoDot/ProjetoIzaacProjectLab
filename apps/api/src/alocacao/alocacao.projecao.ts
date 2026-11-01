import { type Alocacao } from '@filas/contracts';
import { type Prisma } from '@prisma/client';

export const ALOCACAO_COMPLETA = {
  estudante: { select: { id: true, nome: true } },
  supervisor: { select: { id: true, nome: true } },
  sala: { select: { id: true, identificacao: true } },
  autor: { select: { nome: true } },
} satisfies Prisma.AlocacaoInclude;

export type AlocacaoCompleta = Prisma.AlocacaoGetPayload<{ include: typeof ALOCACAO_COMPLETA }>;

export function paraAlocacao(alocacao: AlocacaoCompleta): Alocacao {
  return {
    id: alocacao.id,
    senhaId: alocacao.senhaId,
    estudante: alocacao.estudante,
    supervisor: alocacao.supervisor,
    sala: { id: alocacao.sala.id, nome: alocacao.sala.identificacao },
    confirmadaEm: alocacao.confirmadaEm.toISOString(),
    confirmadaPor: alocacao.autor.nome,
    liberadaEm: alocacao.liberadaEm?.toISOString() ?? null,
  };
}
