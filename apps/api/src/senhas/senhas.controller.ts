import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ConsultarSenhaQuery,
  EmitirSenhaEntrada,
  type Reclassificacao,
  type ReclassificacaoResposta,
  ReclassificarEntrada,
  type SenhaDetalhe,
  type SenhaEmitida,
  type SenhaResumo,
} from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, LeituraSensivel, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { SenhasService } from './senhas.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('senhas')
export class SenhasController {
  constructor(private readonly senhas: SenhasService) {}

  @Post()
  @Requer('senha:criar')
  @Auditar({ entidade: 'senha' })
  emitir(
    @Body(new ZodValidationPipe(EmitirSenhaEntrada)) entrada: EmitirSenhaEntrada,
    @Req() req: Requisicao,
  ): Promise<SenhaEmitida> {
    return this.senhas.emitir(entrada, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('senha:consultar')
  @LeituraSensivel((req) => req.query.incluirTriagem === 'true')
  @Auditar({ entidade: 'senha', modulo: 'triagem' })
  consultar(
    @Param('id', IdPipe) id: string,
    @Query(new ZodValidationPipe(ConsultarSenhaQuery)) query: ConsultarSenhaQuery,
    @Req() req: Requisicao,
  ): Promise<SenhaResumo | SenhaDetalhe> {
    if (!query.incluirTriagem) return this.senhas.consultar(id, req.usuario.unidadeId);
    // O conteúdo clínico exige a permissão da triagem, além da de senha (ADR-003).
    if (!req.usuario.permissoes.includes('triagem:consultar_sensivel')) {
      throw new ForbiddenException();
    }
    return this.senhas.consultarDetalhe(id, req.usuario.unidadeId);
  }

  @Patch(':id/prioridade')
  @Requer('senha:reclassificar')
  @Auditar({ entidade: 'senha' })
  reclassificar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(ReclassificarEntrada)) entrada: ReclassificarEntrada,
    @Req() req: Requisicao,
  ): Promise<ReclassificacaoResposta> {
    return this.senhas.reclassificar(id, entrada, req.usuario.id, req.usuario.unidadeId);
  }

  @Get(':id/reclassificacoes')
  @Requer('senha:consultar')
  historico(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<Reclassificacao[]> {
    return this.senhas.historico(id, req.usuario.unidadeId);
  }
}
