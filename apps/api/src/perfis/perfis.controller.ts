import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  catalogoParaResposta,
  ListarPerfisQuery,
  type ModuloCatalogo,
  type Perfil,
  type PerfilAtualizado,
  PerfilEntrada,
  type RespostaPaginada,
} from '@filas/contracts';

import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { PerfisService } from './perfis.service';

@Controller()
export class PerfisController {
  constructor(private readonly perfis: PerfisService) {}

  /** Catálogo de `packages/contracts`, para a matriz de W-05. */
  @Get('permissoes')
  @Requer('perfis:consultar')
  catalogo(): ModuloCatalogo[] {
    return catalogoParaResposta();
  }

  @Get('perfis')
  @Requer('perfis:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarPerfisQuery)) query: ListarPerfisQuery,
  ): Promise<RespostaPaginada<Perfil>> {
    return this.perfis.listar(query);
  }

  @Post('perfis')
  @Requer('perfis:criar')
  @Auditar({ entidade: 'perfil' })
  criar(@Body(new ZodValidationPipe(PerfilEntrada)) entrada: PerfilEntrada): Promise<Perfil> {
    return this.perfis.criar(entrada);
  }

  @Get('perfis/:id')
  @Requer('perfis:consultar')
  consultar(@Param('id', IdPipe) id: string): Promise<Perfil> {
    return this.perfis.consultar(id);
  }

  @Put('perfis/:id')
  @Requer('perfis:editar')
  @Auditar({ entidade: 'perfil' })
  atualizar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(PerfilEntrada)) entrada: PerfilEntrada,
  ): Promise<PerfilAtualizado> {
    return this.perfis.atualizar(id, entrada);
  }

  @Delete('perfis/:id')
  @Requer('perfis:excluir')
  @Auditar({ entidade: 'perfil' })
  @HttpCode(204)
  excluir(@Param('id', IdPipe) id: string): Promise<void> {
    return this.perfis.excluir(id);
  }
}
