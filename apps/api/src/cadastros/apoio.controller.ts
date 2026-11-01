import { Controller, Get, Query } from '@nestjs/common';
import { type ItemReferencia, ListarApoioQuery, type RespostaPaginada } from '@filas/contracts';

import { Requer } from '../common/autorizacao/decorators';
import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

type TabelaApoio = 'habilitacao' | 'procedimento' | 'recurso';

/** Cadastros de apoio (id e nome): seleções múltiplas de W-04 e filtros (Tabelas 2 a 5). */
@Controller()
export class ApoioController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('habilitacoes')
  @Requer('cadastros:consultar')
  habilitacoes(@Query(new ZodValidationPipe(ListarApoioQuery)) query: ListarApoioQuery) {
    return this.listar('habilitacao', query);
  }

  @Get('procedimentos')
  @Requer('cadastros:consultar')
  procedimentos(@Query(new ZodValidationPipe(ListarApoioQuery)) query: ListarApoioQuery) {
    return this.listar('procedimento', query);
  }

  @Get('recursos')
  @Requer('cadastros:consultar')
  recursos(@Query(new ZodValidationPipe(ListarApoioQuery)) query: ListarApoioQuery) {
    return this.listar('recurso', query);
  }

  private async listar(
    tabela: TabelaApoio,
    query: ListarApoioQuery,
  ): Promise<RespostaPaginada<ItemReferencia>> {
    const where = query.busca
      ? { nome: { contains: query.busca, mode: 'insensitive' as const } }
      : {};
    // As três tabelas têm a mesma forma (id, nome); o delegate é escolhido pelo nome.
    const delegate = this.prisma[tabela] as unknown as {
      findMany(args: object): Promise<ItemReferencia[]>;
      count(args: object): Promise<number>;
    };
    const [dados, total] = await Promise.all([
      delegate.findMany({
        where,
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
        ...deslocamento(query),
      }),
      delegate.count({ where }),
    ]);
    return montarRespostaPaginada(dados, total, query);
  }
}
