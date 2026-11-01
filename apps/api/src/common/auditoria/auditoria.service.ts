import { Injectable } from '@nestjs/common';
import { type OperacaoAuditoria, type Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface RegistroAuditoria {
  usuarioId?: string | null;
  perfilNomeNoMomento?: string | null;
  operacao: OperacaoAuditoria;
  modulo: string;
  entidade: string;
  entidadeId?: string | null;
  justificativa?: string | null;
  origemIp?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  sensivel?: boolean;
}

/**
 * Grava na trilha append-only (`audit_log`, RNF-05). Recebe a transação quando a escrita de
 * negócio e o registro precisam acontecer juntos.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(registro: RegistroAuditoria, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.prisma).auditLog.create({ data: registro });
  }
}
