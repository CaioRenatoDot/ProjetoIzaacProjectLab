import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  ListarTriagensQuery,
  type RespostaPaginada,
  type TriagemDetalhe,
  TriagemEntrada,
  type TriagemResumo,
} from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, LeituraSensivel, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { TriagemService } from './triagem.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('triagens')
export class TriagemController {
  constructor(private readonly triagens: TriagemService) {}

  @Post()
  @Requer('triagem:criar')
  @Auditar({ entidade: 'triagem' })
  registrar(
    @Body(new ZodValidationPipe(TriagemEntrada)) entrada: TriagemEntrada,
    @Req() req: Requisicao,
  ): Promise<TriagemDetalhe> {
    return this.triagens.registrar(entrada, req.usuario.id, req.usuario.unidadeId);
  }

  @Get()
  @Requer('triagem:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarTriagensQuery)) query: ListarTriagensQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<TriagemResumo>> {
    return this.triagens.listar(query, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('triagem:consultar_sensivel')
  @LeituraSensivel()
  @Auditar({ entidade: 'triagem' })
  consultar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<TriagemDetalhe> {
    return this.triagens.consultar(id, req.usuario.unidadeId);
  }
}
