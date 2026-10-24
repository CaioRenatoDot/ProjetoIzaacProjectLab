import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  AlteracaoAtiva,
  AlteracaoAtivo,
  type Especialidade,
  EspecialidadeEntrada,
  ListarEspecialidadesQuery,
  ListarSalasQuery,
  type RespostaPaginada,
  type Sala,
  SalaEntrada,
} from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { EspecialidadesService } from './especialidades.service';
import { SalasService } from './salas.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('salas')
export class SalasController {
  constructor(private readonly salas: SalasService) {}

  @Get()
  @Requer('cadastros:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarSalasQuery)) query: ListarSalasQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<Sala>> {
    return this.salas.listar(query, req.usuario.unidadeId);
  }

  @Post()
  @Requer('cadastros:criar')
  @Auditar({ entidade: 'sala' })
  criar(@Body(new ZodValidationPipe(SalaEntrada)) entrada: SalaEntrada, @Req() req: Requisicao) {
    return this.salas.criar(entrada, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('cadastros:consultar')
  consultar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<Sala> {
    return this.salas.consultar(id, req.usuario.unidadeId);
  }

  @Put(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'sala' })
  atualizar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(SalaEntrada)) entrada: SalaEntrada,
    @Req() req: Requisicao,
  ): Promise<Sala> {
    return this.salas.atualizar(id, entrada, req.usuario.unidadeId);
  }

  @Patch(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'sala' })
  alterarSituacao(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AlteracaoAtivo)) { ativo }: AlteracaoAtivo,
    @Req() req: Requisicao,
  ): Promise<Sala> {
    return this.salas.alterarSituacao(id, ativo, req.usuario.unidadeId);
  }

  @Delete(':id')
  @Requer('cadastros:excluir')
  @Auditar({ entidade: 'sala' })
  @HttpCode(204)
  excluir(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<void> {
    return this.salas.excluir(id, req.usuario.unidadeId);
  }
}

@Controller('especialidades')
export class EspecialidadesController {
  constructor(private readonly especialidades: EspecialidadesService) {}

  @Get()
  @Requer('cadastros:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarEspecialidadesQuery)) query: ListarEspecialidadesQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<Especialidade>> {
    return this.especialidades.listar(query, req.usuario.unidadeId);
  }

  @Post()
  @Requer('cadastros:criar')
  @Auditar({ entidade: 'especialidade' })
  criar(
    @Body(new ZodValidationPipe(EspecialidadeEntrada)) entrada: EspecialidadeEntrada,
    @Req() req: Requisicao,
  ): Promise<Especialidade> {
    return this.especialidades.criar(entrada, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('cadastros:consultar')
  consultar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<Especialidade> {
    return this.especialidades.consultar(id, req.usuario.unidadeId);
  }

  @Put(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'especialidade' })
  atualizar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(EspecialidadeEntrada)) entrada: EspecialidadeEntrada,
    @Req() req: Requisicao,
  ): Promise<Especialidade> {
    return this.especialidades.atualizar(id, entrada, req.usuario.unidadeId);
  }

  @Patch(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'especialidade' })
  alterarSituacao(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AlteracaoAtiva)) { ativa }: AlteracaoAtiva,
    @Req() req: Requisicao,
  ): Promise<Especialidade> {
    return this.especialidades.alterarSituacao(id, ativa, req.usuario.unidadeId);
  }

  @Delete(':id')
  @Requer('cadastros:excluir')
  @Auditar({ entidade: 'especialidade' })
  @HttpCode(204)
  excluir(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<void> {
    return this.especialidades.excluir(id, req.usuario.unidadeId);
  }
}
