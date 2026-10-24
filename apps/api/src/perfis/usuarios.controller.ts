import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  ListarUsuariosQuery,
  type RespostaPaginada,
  type Usuario,
  UsuarioAlteracao,
  UsuarioEntrada,
} from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { UsuariosService } from './usuarios.service';

type RequisicaoComUsuario = Request & { usuario: UsuarioAutenticado };

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @Requer('perfis:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarUsuariosQuery)) query: ListarUsuariosQuery,
  ): Promise<RespostaPaginada<Usuario>> {
    return this.usuarios.listar(query);
  }

  @Post()
  @Requer('perfis:criar')
  @Auditar({ entidade: 'usuario' })
  criar(
    @Body(new ZodValidationPipe(UsuarioEntrada)) entrada: UsuarioEntrada,
    @Req() requisicao: RequisicaoComUsuario,
  ): Promise<Usuario> {
    return this.usuarios.criar(entrada, requisicao.usuario);
  }

  @Get(':id')
  @Requer('perfis:consultar')
  consultar(@Param('id', IdPipe) id: string): Promise<Usuario> {
    return this.usuarios.consultar(id);
  }

  @Patch(':id')
  @Requer('perfis:editar')
  @Auditar({ entidade: 'usuario' })
  alterar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(UsuarioAlteracao)) alteracao: UsuarioAlteracao,
    @Req() requisicao: RequisicaoComUsuario,
  ): Promise<Usuario> {
    return this.usuarios.alterar(id, alteracao, requisicao.usuario);
  }
}
