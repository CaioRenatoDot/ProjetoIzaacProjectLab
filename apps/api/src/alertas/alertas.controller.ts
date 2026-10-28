import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ConsultarAlertasQuery, EscalonamentoEntrada } from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AlertasService, type ContextoAlerta } from './alertas.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };
const contexto = (req: Requisicao): ContextoAlerta => ({
  usuario: req.usuario,
  origemIp: req.ip,
  userAgent: req.headers['user-agent'],
  requestId: req.headers['x-request-id'] as string | undefined,
});

@Controller('alertas')
export class AlertasController {
  constructor(private readonly service: AlertasService) {}

  @Get()
  @Requer('alertas:consultar')
  listar(
    @Query(new ZodValidationPipe(ConsultarAlertasQuery)) query: ConsultarAlertasQuery,
    @Req() req: Requisicao,
  ) {
    return this.service.listar(req.usuario.unidadeId, query);
  }

  @Post(':id/reconhecimento')
  @HttpCode(200)
  @Requer('alertas:reconhecer')
  @Auditar({ entidade: 'alerta', naTransacao: true })
  reconhecer(@Param('id', IdPipe) id: string, @Req() req: Requisicao) {
    return this.service.reconhecer(id, contexto(req));
  }

  @Post(':id/escalonamento')
  @Requer('alertas:escalonar')
  @Auditar({ entidade: 'escalonamento', naTransacao: true })
  escalonar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(EscalonamentoEntrada)) entrada: EscalonamentoEntrada,
    @Req() req: Requisicao,
  ) {
    return this.service.escalonar(id, entrada, contexto(req));
  }
}
