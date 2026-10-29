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
  AlteracaoAtivo,
  ConfirmarQuery,
  type Estudante,
  EstudanteEntrada,
  ListarEstudantesQuery,
  ListarPacientesQuery,
  ListarSupervisoresQuery,
  type Paciente,
  type PacienteDetalhe,
  PacienteEntrada,
  type RespostaPaginada,
  type Supervisor,
  SupervisorEntrada,
} from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { EstudantesService } from './estudantes.service';
import { PacientesService } from './pacientes.service';
import { SupervisoresService } from './supervisores.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientes: PacientesService) {}

  @Get()
  @Requer('cadastros:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarPacientesQuery)) query: ListarPacientesQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<Paciente>> {
    return this.pacientes.listar(query, req.usuario.unidadeId);
  }

  @Post()
  @Requer('cadastros:criar')
  @Auditar({ entidade: 'paciente' })
  criar(
    @Body(new ZodValidationPipe(PacienteEntrada)) entrada: PacienteEntrada,
    @Req() req: Requisicao,
  ): Promise<Paciente> {
    return this.pacientes.criar(entrada, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('cadastros:consultar')
  consultar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<PacienteDetalhe> {
    return this.pacientes.consultar(id, req.usuario.unidadeId);
  }

  @Put(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'paciente' })
  atualizar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(PacienteEntrada)) entrada: PacienteEntrada,
    @Req() req: Requisicao,
  ): Promise<Paciente> {
    return this.pacientes.atualizar(id, entrada, req.usuario.unidadeId);
  }

  @Patch(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'paciente' })
  alterarSituacao(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AlteracaoAtivo)) { ativo }: AlteracaoAtivo,
    @Req() req: Requisicao,
  ): Promise<Paciente> {
    return this.pacientes.alterarSituacao(id, ativo, req.usuario.unidadeId);
  }

  @Delete(':id')
  @Requer('cadastros:excluir')
  @Auditar({ entidade: 'paciente' })
  @HttpCode(204)
  excluir(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<void> {
    return this.pacientes.excluir(id, req.usuario.unidadeId);
  }
}

@Controller('estudantes')
export class EstudantesController {
  constructor(private readonly estudantes: EstudantesService) {}

  @Get()
  @Requer('cadastros:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarEstudantesQuery)) query: ListarEstudantesQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<Estudante>> {
    return this.estudantes.listar(query, req.usuario.unidadeId);
  }

  @Post()
  @Requer('cadastros:criar')
  @Auditar({ entidade: 'estudante' })
  criar(
    @Body(new ZodValidationPipe(EstudanteEntrada)) entrada: EstudanteEntrada,
    @Req() req: Requisicao,
  ): Promise<Estudante> {
    return this.estudantes.criar(entrada, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('cadastros:consultar')
  consultar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<Estudante> {
    return this.estudantes.consultar(id, req.usuario.unidadeId);
  }

  @Put(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'estudante' })
  atualizar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(EstudanteEntrada)) entrada: EstudanteEntrada,
    @Query(new ZodValidationPipe(ConfirmarQuery)) { confirmar }: ConfirmarQuery,
    @Req() req: Requisicao,
  ): Promise<Estudante> {
    return this.estudantes.atualizar(id, entrada, req.usuario.unidadeId, confirmar);
  }

  @Patch(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'estudante' })
  alterarSituacao(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AlteracaoAtivo)) { ativo }: AlteracaoAtivo,
    @Query(new ZodValidationPipe(ConfirmarQuery)) { confirmar }: ConfirmarQuery,
    @Req() req: Requisicao,
  ): Promise<Estudante> {
    return this.estudantes.alterarSituacao(id, ativo, req.usuario.unidadeId, confirmar);
  }

  @Delete(':id')
  @Requer('cadastros:excluir')
  @Auditar({ entidade: 'estudante' })
  @HttpCode(204)
  excluir(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<void> {
    return this.estudantes.excluir(id, req.usuario.unidadeId);
  }
}

@Controller('supervisores')
export class SupervisoresController {
  constructor(private readonly supervisores: SupervisoresService) {}

  @Get()
  @Requer('cadastros:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarSupervisoresQuery)) query: ListarSupervisoresQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<Supervisor>> {
    return this.supervisores.listar(query, req.usuario.unidadeId);
  }

  @Post()
  @Requer('cadastros:criar')
  @Auditar({ entidade: 'supervisor' })
  criar(
    @Body(new ZodValidationPipe(SupervisorEntrada)) entrada: SupervisorEntrada,
    @Req() req: Requisicao,
  ): Promise<Supervisor> {
    return this.supervisores.criar(entrada, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('cadastros:consultar')
  consultar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<Supervisor> {
    return this.supervisores.consultar(id, req.usuario.unidadeId);
  }

  @Put(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'supervisor' })
  atualizar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(SupervisorEntrada)) entrada: SupervisorEntrada,
    @Query(new ZodValidationPipe(ConfirmarQuery)) { confirmar }: ConfirmarQuery,
    @Req() req: Requisicao,
  ): Promise<Supervisor> {
    return this.supervisores.atualizar(id, entrada, req.usuario.unidadeId, confirmar);
  }

  @Patch(':id')
  @Requer('cadastros:editar')
  @Auditar({ entidade: 'supervisor' })
  alterarSituacao(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AlteracaoAtivo)) { ativo }: AlteracaoAtivo,
    @Query(new ZodValidationPipe(ConfirmarQuery)) { confirmar }: ConfirmarQuery,
    @Req() req: Requisicao,
  ): Promise<Supervisor> {
    return this.supervisores.alterarSituacao(id, ativo, req.usuario.unidadeId, confirmar);
  }

  @Delete(':id')
  @Requer('cadastros:excluir')
  @Auditar({ entidade: 'supervisor' })
  @HttpCode(204)
  excluir(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<void> {
    return this.supervisores.excluir(id, req.usuario.unidadeId);
  }
}
