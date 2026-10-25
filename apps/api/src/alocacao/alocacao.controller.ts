import { Body, Controller, Headers, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import {
  AguardandoRecursoEntrada,
  type Alocacao,
  AlocacaoEntrada,
  type SenhaResumo,
} from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AlocacaoService } from './alocacao.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('senhas/:id')
export class AlocacaoController {
  constructor(private readonly alocacao: AlocacaoService) {}

  @Post('alocacao')
  @Requer('alocacao:criar')
  @Auditar({ entidade: 'alocacao' })
  confirmar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AlocacaoEntrada)) entrada: AlocacaoEntrada,
    @Headers('idempotency-key') chave: string | undefined,
    @Req() req: Requisicao,
  ): Promise<Alocacao> {
    return this.alocacao.confirmar(id, entrada, req.usuario, chave);
  }

  @Put('alocacao')
  @Requer('alocacao:editar')
  @Auditar({ entidade: 'alocacao' })
  trocar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AlocacaoEntrada)) entrada: AlocacaoEntrada,
    @Req() req: Requisicao,
  ): Promise<Alocacao> {
    return this.alocacao.trocar(id, entrada, req.usuario);
  }

  @Post('aguardando-recurso')
  @Requer('alocacao:criar')
  @HttpCode(200)
  @Auditar({ entidade: 'senha', modulo: 'alocacao', operacao: 'EDITAR' })
  manterAguardando(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AguardandoRecursoEntrada)) entrada: AguardandoRecursoEntrada,
    @Req() req: Requisicao,
  ): Promise<SenhaResumo> {
    return this.alocacao.manterAguardando(id, entrada, req.usuario.unidadeId);
  }
}
