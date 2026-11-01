import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  type Chamada,
  ChamarProximaEntrada,
  type Fila,
  FilaEntrada,
  ListarFilasQuery,
  type QuadroFila,
  QuadroFilaQuery,
  type RespostaPaginada,
  type ResultadoChamada,
  type SenhaResumo,
} from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { ChamadasService } from './chamadas.service';
import { FilasService } from './filas.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('filas')
export class FilasController {
  constructor(
    private readonly filas: FilasService,
    private readonly chamadas: ChamadasService,
  ) {}

  @Get()
  @Requer('fila:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarFilasQuery)) query: ListarFilasQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<Fila>> {
    return this.filas.listar(query, req.usuario.unidadeId);
  }

  @Post()
  @Requer('fila:criar')
  @Auditar({ entidade: 'fila' })
  criar(
    @Body(new ZodValidationPipe(FilaEntrada)) entrada: FilaEntrada,
    @Req() req: Requisicao,
  ): Promise<Fila> {
    return this.filas.criar(entrada, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('fila:consultar')
  consultar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<Fila> {
    return this.filas.consultar(id, req.usuario.unidadeId);
  }

  @Put(':id')
  @Requer('fila:editar')
  @Auditar({ entidade: 'fila' })
  atualizar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(FilaEntrada)) entrada: FilaEntrada,
    @Req() req: Requisicao,
  ): Promise<Fila> {
    return this.filas.atualizar(id, entrada, req.usuario.unidadeId);
  }

  @Delete(':id')
  @Requer('fila:excluir')
  @HttpCode(204)
  @Auditar({ entidade: 'fila' })
  excluir(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<void> {
    return this.filas.excluir(id, req.usuario.unidadeId);
  }

  @Get(':id/senhas')
  @Requer('fila:consultar')
  quadro(
    @Param('id', IdPipe) id: string,
    @Query(new ZodValidationPipe(QuadroFilaQuery)) query: QuadroFilaQuery,
    @Req() req: Requisicao,
  ): Promise<QuadroFila> {
    return this.filas.quadro(id, query, req.usuario.unidadeId);
  }

  @Post(':id/chamadas')
  @Requer('fila:chamar')
  @Auditar({ entidade: 'chamada', operacao: 'CRIAR' })
  chamarProxima(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(ChamarProximaEntrada)) entrada: ChamarProximaEntrada,
    @Headers('idempotency-key') chave: string | undefined,
    @Req() req: Requisicao,
  ): Promise<ResultadoChamada> {
    return this.chamadas.chamarProxima(id, entrada, req.usuario, chave);
  }
}

@Controller('chamadas')
export class ChamadasController {
  constructor(private readonly chamadas: ChamadasService) {}

  @Post(':id/rechamada')
  @Requer('fila:chamar')
  @Auditar({ entidade: 'chamada', modulo: 'fila' })
  rechamar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<Chamada> {
    return this.chamadas.rechamar(id, req.usuario);
  }

  @Delete(':id')
  @Requer('fila:chamar')
  @Auditar({ entidade: 'chamada', modulo: 'fila' })
  cancelar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<SenhaResumo> {
    return this.chamadas.cancelar(id, req.usuario.unidadeId);
  }
}
