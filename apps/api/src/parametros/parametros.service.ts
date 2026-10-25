import { Injectable } from '@nestjs/common';
import { type ParametrosVigentes } from '@filas/contracts';
import { type ChaveParametro } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const CAMPO_POR_CHAVE: Record<ChaveParametro, keyof ParametrosVigentes> = {
  TOLERANCIA_MINUTOS: 'toleranciaMinutos',
  SLA_MINUTOS: 'slaMinutos',
  REINCIDENCIAS_RESTRICAO: 'reincidenciasRestricao',
  JANELA_REINCIDENCIA_DIAS: 'janelaReincidenciaDias',
  LIMITE_ESTUDANTES_SUPERVISOR: 'limiteEstudantesSupervisor',
  JUSTIFICATIVA_MIN_CARACTERES: 'justificativaMinCaracteres',
};

/**
 * Parâmetros da unidade em vigor (Tabela 8, docs/01 §4.7): o valor da especialidade sobrepõe o
 * geral. Nenhum valor tem padrão no código.
 */
@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  async vigentes(unidadeId: string, especialidadeId?: string | null): Promise<ParametrosVigentes> {
    const linhas = await this.prisma.parametroUnidade.findMany({
      where: {
        unidadeId,
        OR: [{ especialidadeId: null }, ...(especialidadeId ? [{ especialidadeId }] : [])],
      },
      select: { chave: true, valor: true, especialidadeId: true },
    });
    const valores: Partial<ParametrosVigentes> = {};
    for (const linha of linhas.sort(
      (a, b) => Number(a.especialidadeId !== null) - Number(b.especialidadeId !== null),
    )) {
      valores[CAMPO_POR_CHAVE[linha.chave]] = linha.valor;
    }
    const faltando = Object.values(CAMPO_POR_CHAVE).filter((campo) => valores[campo] === undefined);
    if (faltando.length) {
      // Erro de configuração: vira 500 genérico e vai para o log com os nomes que faltam.
      throw new Error(`Parâmetros da unidade ${unidadeId} sem valor: ${faltando.join(', ')}`);
    }
    return valores as ParametrosVigentes;
  }
}
